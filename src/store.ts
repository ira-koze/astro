import { create } from "zustand";
import type { AstroDockGeom, AstroDockMode, AstroLink, AstroMessage, AstroProductContext, AstroSite } from "./types";
import { getAstroOff, setAstroOff, getAstroDockGeom, setAstroDockGeom, getOrCreateConversationId, resetConversationId } from "./cookies";
import { sendAstroChat, sendAstroFeedback, streamAstroChat } from "./api";

const DEFAULT_DOCK: AstroDockGeom = { side: "left", x: 16, y: 96, width: 400, mode: "collapsed" };

const getConversationId = () => getOrCreateConversationId();

const inferPageKind = (pathname: string, hasProduct: boolean): string => {
  if (hasProduct) return "product";
  if (pathname.includes("/shop") || pathname.includes("/products")) return "shop";
  if (pathname.includes("/cart")) return "cart";
  if (pathname.includes("/legal")) return "legal";
  if (pathname.includes("/astro")) return "astro";
  if (pathname.includes("/projects")) return "projects";
  if (pathname.includes("/blog")) return "blog";
  if (pathname.includes("/docs") || pathname.includes("/api")) return "docs";
  if (pathname.includes("/book")) return "booking";
  if (pathname === "/" || /^\/[a-z]{2}\/?$/.test(pathname)) return "homepage";
  return "site";
};

export interface AstroStoreState {
  open: boolean;
  off: boolean;
  loading: boolean;
  streaming: boolean;
  agentStatus: string | null;
  dockMode: AstroDockMode;
  messages: AstroMessage[];
  productContext: AstroProductContext | null;
  selectedContext: string;
  dock: AstroDockGeom;
  feedbackStatus: "idle" | "thanks" | "error";
  site: AstroSite;
  apiEndpoint?: string;
  trackEvent?: (event: string, properties?: Record<string, unknown>) => void;
  cartItems?: { id?: string; slug?: string; name: string; category?: string; price?: number }[];
}

export interface AstroStoreActions {
  hydrateDock: () => void;
  setDock: (geom: AstroDockGeom, persist?: boolean) => void;
  setDockMode: (mode: AstroDockMode, persist?: boolean) => void;
  setProductContext: (ctx: AstroProductContext | null) => void;
  setSelectedContext: (text: string) => void;
  setCartItems: (items: { id?: string; slug?: string; name: string; category?: string; price?: number }[]) => void;
  openAstro: (mode?: AstroDockMode) => void;
  closeAstro: () => void;
  clearMessages: () => void;
  setOff: (off: boolean) => void;
  sendQuestion: (question: string) => Promise<void>;
  askFromChip: (question: string) => void;
  sendFeedback: (messageIndex: number, value: "up" | "down", reason?: string) => Promise<boolean>;
  clearFeedbackStatus: () => void;
}

export type AstroStore = AstroStoreState & AstroStoreActions;

export function createAstroStore(
  site: AstroSite,
  options?: {
    apiEndpoint?: string;
    trackEvent?: (event: string, properties?: Record<string, unknown>) => void;
  },
) {
  return create<AstroStore>((set, get) => ({
    open: false,
    off: false,
    loading: false,
    streaming: false,
    agentStatus: null,
    dockMode: "collapsed",
    messages: [],
    productContext: null,
    selectedContext: "",
    dock: DEFAULT_DOCK,
    feedbackStatus: "idle",
    site,
    apiEndpoint: options?.apiEndpoint,
    trackEvent: options?.trackEvent,
    cartItems: [],

    hydrateDock: () => {
      const off = getAstroOff();
      const stored = getAstroDockGeom();
      set({
        dock: stored ?? DEFAULT_DOCK,
        dockMode: stored?.mode ?? "collapsed",
        off,
      });
    },

    setDock: (geom, persist = false) => {
      set({ dock: geom, dockMode: geom.mode ?? get().dockMode });
      if (persist) setAstroDockGeom(geom);
    },

    setDockMode: (mode, persist = false) => {
      const geom = { ...get().dock, mode };
      set({ dockMode: mode, dock: geom });
      if (persist) setAstroDockGeom(geom);
    },

    setProductContext: (productContext) => set({ productContext }),
    setSelectedContext: (selectedContext) => set({ selectedContext }),
    setCartItems: (items) => set({ cartItems: items }),

    openAstro: (mode = "peek") => {
      if (get().off) return;
      if (!get().open) get().trackEvent?.("astro_open", { mode, site });
      set({ open: true, dockMode: mode });
      const geom = { ...get().dock, mode };
      set({ dock: geom });
      setAstroDockGeom(geom);
    },

    closeAstro: () => {
      set({ open: false, dockMode: "collapsed" });
      const geom = { ...get().dock, mode: "collapsed" as AstroDockMode };
      set({ dock: geom });
      setAstroDockGeom(geom);
    },

    clearMessages: () => {
      resetConversationId();
      set({ messages: [], feedbackStatus: "idle" });
    },

    setOff: (off) => {
      setAstroOff(off);
      set({ off, open: off ? false : get().open });
    },

    clearFeedbackStatus: () => set({ feedbackStatus: "idle" }),

    sendQuestion: async (question) => {
      const q = question.trim();
      if (!q || get().loading) return;
      const { productContext, selectedContext, site, cartItems } = get();

      const recentMessages = get().messages.slice(-12).map((m) => ({
        role: m.role as "user" | "assistant",
        text: m.text,
      }));

      set((s) => ({
        messages: [...s.messages, { role: "user", text: q }, { role: "assistant", text: "" }],
        loading: true,
        streaming: false,
        agentStatus: "thinking",
        feedbackStatus: "idle",
      }));

      const pathnameHint = typeof window !== "undefined" ? window.location.pathname : "";
      const pageKind = productContext?.pageKind || inferPageKind(pathnameHint, Boolean(productContext));
      const detectedLocale = (() => {
        const match = pathnameHint.match(/^\/([a-z]{2,3}(?:-[A-Z]+)?)\//);
        return match ? match[1] : "en";
      })();

      get().trackEvent?.("astro_question", { question: q.slice(0, 100), site, pageKind });

      const contextForRequest = selectedContext;
      const request = {
        question: q,
        locale: detectedLocale,
        site,
        conversationId: getConversationId(),
        messages: recentMessages.length > 0 ? recentMessages : undefined,
        cartItems: cartItems && cartItems.length > 0 ? cartItems.slice(0, 10) : undefined,
        productContext: productContext
          ? {
              productId: productContext.productId,
              name: productContext.name,
              slug: productContext.slug,
              category: productContext.category,
              description: productContext.description,
              selectedContext: contextForRequest,
              specs: productContext.specs,
              price: productContext.price,
              regularPrice: productContext.regularPrice,
              intentContext: productContext.intentContext,
              relatedProducts: productContext.relatedProducts,
              pageKind,
              pathnameHint,
            }
          : {
              name: "HRNT",
              category: site,
              selectedContext: contextForRequest,
              pageKind,
              pathnameHint,
            },
      };

      const updateLastAssistant = (updater: (msg: AstroMessage) => AstroMessage) => {
        set((s) => {
          const msgs = [...s.messages];
          const last = msgs.length - 1;
          if (last >= 0 && msgs[last].role === "assistant") {
            msgs[last] = updater(msgs[last]);
          }
          return { messages: msgs };
        });
      };

      try {
        await streamAstroChat(
          request,
          (event) => {
            switch (event.type) {
              case "token":
                if (!get().streaming) set({ streaming: true, agentStatus: null });
                updateLastAssistant((msg) => ({ ...msg, text: (msg.text || "") + event.content }));
                break;
              case "agentStatus":
                set({ agentStatus: event.status });
                break;
              case "revision":
                updateLastAssistant((msg) => ({ ...msg, text: event.answer }));
                break;
              case "handoff":
                updateLastAssistant((msg) => ({ ...msg, handoffMessage: event.message }));
                break;
              case "done":
                updateLastAssistant((msg) => ({
                  ...msg,
                  text: event.answer,
                  followUps: event.followUps || [],
                  links: event.links || [],
                  actions: event.actions || [],
                  showAddToCart: event.showAddToCart ?? false,
                }));
                set({ selectedContext: "", streaming: false, agentStatus: null });
                break;
              case "replace":
                updateLastAssistant((msg) => ({
                  ...msg,
                  text: event.answer,
                  followUps: event.followUps || [],
                  links: event.links || [],
                  actions: event.actions || [],
                  showAddToCart: event.showAddToCart ?? false,
                }));
                set({ selectedContext: "", streaming: false, agentStatus: null });
                break;
              case "error":
                updateLastAssistant(() => ({
                  role: "assistant",
                  text: "I can't reach the AI service right now. Please try again in a moment.",
                }));
                set({ streaming: false, agentStatus: null });
                break;
            }
          },
          get().apiEndpoint,
        );
      } catch (err) {
        console.error("[astro-stream] Error:", err instanceof Error ? err.message : err);
        updateLastAssistant(() => ({
          role: "assistant",
          text: "I can't reach the AI service right now. Please try again in a moment.",
        }));
      } finally {
        set({ loading: false, agentStatus: null });
      }
    },

    askFromChip: (question) => {
      get().openAstro("peek");
      setTimeout(() => get().sendQuestion(question), 60);
    },

    sendFeedback: async (messageIndex, value, reason) => {
      const { messages, productContext, site } = get();
      const msg = messages[messageIndex];
      if (!msg || msg.role !== "assistant") return false;

      const payload = {
        conversationId: getConversationId(),
        site,
        productId: productContext?.productId,
        productName: productContext?.name,
        value,
        reason,
        message: msg.text,
      };

      try {
        const ok = await sendAstroFeedback(payload, get().apiEndpoint);
        if (!ok) throw new Error("feedback failed");
        set({ feedbackStatus: "thanks" });
        get().trackEvent?.("astro_feedback", { value, hasReason: Boolean(reason), site });
        setTimeout(() => get().clearFeedbackStatus(), 2400);
        return true;
      } catch {
        set({ feedbackStatus: "error" });
        setTimeout(() => get().clearFeedbackStatus(), 3200);
        return false;
      }
    },
  }));
}
