import { create } from "zustand";
import type { AstroDockGeom, AstroDockMode, AstroLink, AstroMessage, AstroProductContext, AstroSite } from "./types";
import { getAstroOff, setAstroOff, getAstroDockGeom, setAstroDockGeom } from "./cookies";
import { sendAstroChat, sendAstroFeedback } from "./api";

const DEFAULT_DOCK: AstroDockGeom = { side: "left", x: 16, y: 96, width: 400, mode: "collapsed" };

const getConversationId = () => {
  if (typeof window === "undefined") return "server";
  const key = "hrnt_astro_conversation_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `astro_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
};

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

    clearMessages: () => set({ messages: [], feedbackStatus: "idle" }),

    setOff: (off) => {
      setAstroOff(off);
      set({ off, open: off ? false : get().open });
    },

    clearFeedbackStatus: () => set({ feedbackStatus: "idle" }),

    sendQuestion: async (question) => {
      const q = question.trim();
      if (!q || get().loading) return;
      const { productContext, selectedContext, site, cartItems } = get();

      // Extract history BEFORE adding current question to avoid duplication ΓÇö
      // the current question is sent separately as `question` in the request.
      const recentMessages = get().messages.slice(-12).map((m) => ({
        role: m.role as "user" | "assistant",
        text: m.text,
      }));

      set((s) => ({
        messages: [...s.messages, { role: "user", text: q }],
        loading: true,
        feedbackStatus: "idle",
      }));

      try {
        const pathnameHint = typeof window !== "undefined" ? window.location.pathname : "";
        const pageKind = productContext?.pageKind || inferPageKind(pathnameHint, Boolean(productContext));
        const detectedLocale = (() => {
          const match = pathnameHint.match(/^\/([a-z]{2,3}(?:-[A-Z]+)?)\//);
          return match ? match[1] : "en";
        })();

        get().trackEvent?.("astro_question", { question: q.slice(0, 100), site, pageKind });

        const contextForRequest = selectedContext;
        const res = await sendAstroChat(
          {
            question: q,
            locale: detectedLocale,
            site,
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
          },
          get().apiEndpoint,
        );

        set((s) => ({
          messages: [
            ...s.messages,
            {
              role: "assistant",
              text: res.answer,
              links: res.links || [],
              followUps: res.unavailable ? [] : (res.followUps || []),
              actions: res.unavailable ? [] : (res.actions || []),
              showAddToCart: res.unavailable ? false : (res.showAddToCart ?? false),
            },
          ],
          selectedContext: "",
        }));
      } catch {
        set((s) => ({
          messages: [
            ...s.messages,
            {
              role: "assistant",
              text: "I can't reach the AI service right now. Please try again in a moment.",
            },
          ],
        }));
      } finally {
        set({ loading: false });
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
