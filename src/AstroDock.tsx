import React, { useEffect, useRef, useState } from "react";
import { GripVertical, Maximize2, Minimize2, MoreVertical, Send, ShoppingCart, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { AstroIcon } from "./AstroIcon";
import { useAstroDockContext } from "./AstroDockContext";
import type { AstroDockGeom } from "./types";

function splitMarkdownRow(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) => {
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          const isExternal = /^https?:\/\//i.test(linkMatch[2]);
          return (
            <a
              key={i}
              href={linkMatch[2]}
              {...(isExternal ? { target: "_blank", rel: "noreferrer" } : {})}
              className="font-bold text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
            >
              {linkMatch[1]}
            </a>
          );
        }
        return part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-black text-ink">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        );
      })}
    </>
  );
}

function renderMessageText(
  text: string,
  renderLink: (props: { href: string; onClick?: () => void; children: React.ReactNode; className?: string }) => React.ReactNode,
  renderImage?: (props: { src: string; alt: string; className?: string }) => React.ReactNode,
  closeAstro?: () => void,
): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let listBuf: { type: "ul" | "ol"; items: React.ReactNode[] } | null = null;

  const flushList = () => {
    if (!listBuf) return;
    if (listBuf.type === "ul") {
      nodes.push(
        <ul key={`ul-${nodes.length}`} className="mt-2 space-y-1.5">
          {listBuf.items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>,
      );
    } else {
      nodes.push(
        <ol key={`ol-${nodes.length}`} className="mt-2 space-y-1.5 ps-4 list-decimal marker:text-brand marker:font-black marker:text-xs">
          {listBuf.items.map((item, idx) => (
            <li key={idx} className="ps-1">{item}</li>
          ))}
        </ol>,
      );
    }
    listBuf = null;
  };

  while (i < lines.length) {
    const t = lines[i].trim();
    const next = lines[i + 1]?.trim() ?? "";
    if (!t) { flushList(); i++; continue; }

    if (t.startsWith("|") && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(next)) {
      flushList();
      const headers = splitMarkdownRow(t);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitMarkdownRow(lines[i]));
        i++;
      }
      nodes.push(
        <div key={`tbl-${nodes.length}`} className="mt-3 overflow-x-auto rounded-xl border border-[var(--divider-subtle)]">
          <table className="w-full text-start text-xs">
            <thead className="bg-surface">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="px-3 py-2 font-black uppercase tracking-[0.12em] text-ink/50 whitespace-nowrap">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--divider-subtle)]">
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 font-semibold text-ink/80">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const imgMatch = t.match(/^!\[([^\]]*)\]\((https?:\/\/[^)]+)\)$/);
    if (imgMatch) {
      flushList();
      if (renderImage) {
        nodes.push(
          React.createElement(renderImage, { key: `img-${nodes.length}`, src: imgMatch[2], alt: imgMatch[1] || "Image", className: "mt-3 max-h-48 w-full rounded-xl object-cover" }),
        );
      } else {
        nodes.push(
          <img key={`img-${nodes.length}`} src={imgMatch[2]} alt={imgMatch[1] || "Image"} className="mt-3 max-h-48 w-full rounded-xl object-cover" />,
        );
      }
      i++;
      continue;
    }

    const isHeader =
      /^\*\*[^*]+\*\*:?$/.test(t) ||
      (t.endsWith(":") && t.length < 36 && !/[.!?,]/.test(t.slice(0, -1)) && t.split(" ").length <= 4);
    if (isHeader) {
      flushList();
      const label = t.replace(/^\*\*|\*\*$/g, "").replace(/:$/, "");
      nodes.push(
        <p key={`hd-${nodes.length}`} className="mt-3 mb-0.5 font-semibold text-[10px] uppercase tracking-[0.16em] text-ink/50 first:mt-0">
          {label}
        </p>,
      );
      i++;
      continue;
    }

    const raw = lines[i];
    const bulletMatch: RegExpMatchArray | null =
      t.match(/^[-ΓÇó*]\s+(.+)/) ??
      (!t.match(/^\d+[.)]/) && raw.startsWith("    ") ? raw.match(/^ {4}(.+)/) : null);
    if (bulletMatch) {
      if (listBuf?.type !== "ul") { flushList(); listBuf = { type: "ul", items: [] }; }
      listBuf.items.push(renderInline(bulletMatch[1]));
      i++;
      continue;
    }

    const numMatch = t.match(/^(\d+)[.)]\s+(.+)/);
    if (numMatch) {
      if (listBuf?.type !== "ol") { flushList(); listBuf = { type: "ol", items: [] }; }
      listBuf.items.push(renderInline(numMatch[2]));
      i++;
      continue;
    }

    flushList();
    nodes.push(
      <p key={`p-${nodes.length}`} className={nodes.length > 0 ? "mt-2" : undefined}>
        {renderInline(t)}
      </p>,
    );
    i++;
  }

  flushList();
  return nodes;
}

const MIN_W = 360;
const MAX_W = 640;

export const AstroDock: React.FC = () => {
  const ctx = useAstroDockContext();
  const { store, t, tp, renderLink, renderImage, addToCart, formatPrice, aboutHref, chips, productChips, shouldTriggerHelp, dismissHelp } = ctx;
  const {
    open,
    off,
    loading,
    dockMode,
    messages,
    productContext,
    selectedContext,
    dock,
    feedbackStatus,
    site,
    hydrateDock,
    setDock,
    setDockMode,
    setSelectedContext,
    openAstro,
    closeAstro,
    clearMessages,
    setOff,
    sendQuestion,
    sendFeedback,
  } = store();

  const displayPrice = (amount?: number): string | null => {
    if (typeof amount !== "number") return null;
    if (amount <= 0) return t("free");
    return formatPrice ? formatPrice(amount) : `${amount}`;
  };

  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [cartedFromChat, setCartedFromChat] = useState(false);
  const [feedbackOpenFor, setFeedbackOpenFor] = useState<number | null>(null);
  const [feedbackReason, setFeedbackReason] = useState("");
  const [selectionBubble, setSelectionBubble] = useState<{ text: string; x: number; y: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragState = useRef<{ kind: "move" | "resize"; px: number; py: number; geom: AstroDockGeom } | null>(null);
  const useSideRail = site === "shop" && !isMobile;

  const lastAssistantIndex = messages.reduce(
    (last, msg, idx) => (msg.role === "assistant" ? idx : last),
    -1,
  );

  useEffect(() => {
    setMounted(true);
    hydrateDock();
  }, [hydrateDock]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAstro();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closeAstro]);

  // Friction reduction: trigger Astro after persistent browsing without action
  useEffect(() => {
    if (off || open) return;
    if (shouldTriggerHelp?.()) {
      const timeoutId = window.setTimeout(() => {
        openAstro("peek");
        store.getState().trackEvent?.("astro_friction_trigger", {
          reason: "persistent_browsing",
        });
        dismissHelp?.();
      }, 3000);
      return () => window.clearTimeout(timeoutId);
    }
  }, [off, open, openAstro, shouldTriggerHelp, dismissHelp, store]);

  // Global highlight-to-Astro
  useEffect(() => {
    if (off) return;
    const handler = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (!text || text.length < 3) {
        setSelectionBubble(null);
        return;
      }
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const rect = range?.getBoundingClientRect();
      if (!rect) return;
      setSelectionBubble({
        text: text.slice(0, 180),
        x: rect.left + rect.width / 2,
        y: Math.max(12, rect.top - 42),
      });
    };
    document.addEventListener("mouseup", handler);
    document.addEventListener("keyup", handler);
    return () => {
      document.removeEventListener("mouseup", handler);
      document.removeEventListener("keyup", handler);
    };
  }, [off]);

  const onPointerMove = (e: PointerEvent) => {
    const st = dragState.current;
    if (!st) return;
    const dx = e.clientX - st.px;
    const dy = e.clientY - st.py;
    if (st.kind === "move") {
      const x = Math.max(8, Math.min(window.innerWidth - st.geom.width - 8, st.geom.x + dx));
      const y = Math.max(64, Math.min(window.innerHeight - 160, st.geom.y + dy));
      setDock({ ...st.geom, x, y });
    } else {
      const width = Math.max(MIN_W, Math.min(MAX_W, st.geom.width + dx));
      setDock({ ...st.geom, width });
    }
  };

  const endDrag = () => {
    if (dragState.current) {
      const kind = dragState.current.kind;
      dragState.current = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      setDock(store.getState().dock, true);
      if (kind === "resize") store.getState().trackEvent?.("astro_dock_resize", { width: store.getState().dock.width });
    }
  };

  const startDrag = (kind: "move" | "resize") => (e: React.PointerEvent) => {
    if (isMobile) return;
    e.preventDefault();
    dragState.current = { kind, px: e.clientX, py: e.clientY, geom: { ...dock } };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
  };

  // Don't render on admin routes
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) return null;

  if (!mounted) return null;

  if (off) {
    return (
      <>
        {useSideRail ? (
          <button
            type="button"
            data-hrnt-astro-root=""
            onClick={() => setOff(false)}
            aria-label={t("reEnableAstroAssistant")}
            className="group fixed start-0 top-1/2 z-[var(--z-astro)] flex min-h-[128px] w-9 -translate-y-1/2 flex-col items-center justify-center gap-2 rounded-e-[14px] border border-s-0 border-ink/15 bg-ink/70 text-[10px] font-black uppercase tracking-[0.14em] text-ink/40 shadow-[0_12px_24px_rgba(0,0,0,.1)] grayscale transition-all hover:grayscale-0 hover:border-brand/35 hover:bg-brand hover:text-white hover:shadow-[0_12px_40px_rgba(0,0,0,.28)]"
          >
            <AstroIcon className="h-4 w-4" />
            <span className="[writing-mode:vertical-rl] rotate-180">{t("astro")}</span>
          </button>
        ) : (
          <button
            type="button"
            data-hrnt-astro-root=""
            onClick={() => setOff(false)}
            aria-label={t("reEnableAstroAssistant")}
            className="fixed bottom-4 start-4 z-[var(--z-astro)] grid h-12 w-12 place-items-center rounded-full border border-[var(--divider-subtle)] bg-surface/70 shadow-[0_16px_40px_rgba(0,0,0,.12)] grayscale transition-all hover:grayscale-0 hover:bg-surface hover:shadow-[0_16px_40px_rgba(0,0,0,.32)]"
          >
            <AstroIcon className="h-6 w-6 text-ink-muted" />
          </button>
        )}
      </>
    );
  }

  const panelStyle: React.CSSProperties = isMobile
    ? {
        insetInlineStart: 12,
        insetInlineEnd: 12,
        bottom: 12,
        top: "auto",
        width: "auto",
        maxHeight: "min(70dvh, 640px)",
      }
    : dockMode === "expanded"
      ? {
          insetInlineStart: dock.x,
          top: dock.y,
          width: dock.width,
          height: "min(78dvh, 760px)",
        }
      : useSideRail
        ? {
            insetInlineStart: 0,
            top: 88,
            width: 320,
            height: "calc(100dvh - 112px)",
          }
      : {
          insetInlineStart: 16,
          bottom: 16,
          top: "auto",
          width: "min(360px, calc(100vw - 32px))",
          height: "min(70dvh, 560px)",
        };

  return (
    <>
      {selectionBubble && (
        <button
          type="button"
          data-hrnt-astro-root=""
          onClick={() => {
            setSelectedContext(selectionBubble.text);
            setSelectionBubble(null);
            openAstro();
          }}
          className="fixed z-[calc(var(--z-astro)+10)] inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-surface px-3 py-1.5 text-xs font-black text-ink shadow-[0_14px_34px_rgba(0,0,0,.22)] hover:text-brand"
          style={{ insetInlineStart: selectionBubble.x, top: selectionBubble.y, transform: "translateX(-50%)" }}
        >
          <AstroIcon className="h-4 w-4 text-brand" />
          {t("askAstro")}
        </button>
      )}

      {!open && (
        useSideRail ? (
          <button
            type="button"
            data-hrnt-astro-root=""
            onClick={() => openAstro("peek")}
            aria-label={t("openAstroAssistant")}
            className="group fixed start-0 top-1/2 z-[var(--z-astro)] flex min-h-[128px] w-9 -translate-y-1/2 flex-col items-center justify-center gap-2 rounded-e-[14px] border border-s-0 border-brand/35 bg-brand text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-[0_12px_40px_rgba(0,0,0,.28)] transition-[width] hover:w-10"
          >
            <AstroIcon className="h-4 w-4" />
            <span className="[writing-mode:vertical-rl] rotate-180">{t("astro")}</span>
          </button>
        ) : (
          <button
            type="button"
            data-hrnt-astro-root=""
            onClick={() => openAstro("peek")}
            aria-label={t("openAstroAssistant")}
            className="fixed bottom-4 start-4 z-[var(--z-astro)] grid h-12 w-12 place-items-center rounded-full border border-[var(--divider-subtle)] bg-surface text-brand shadow-[0_16px_40px_rgba(0,0,0,.32)]"
          >
            <AstroIcon className="h-6 w-6" />
          </button>
        )
      )}

      {open && (
        <div
          data-hrnt-astro-root=""
          className={`fixed z-[var(--z-astro)] flex flex-col overflow-hidden border border-[var(--divider-subtle)] bg-surface shadow-[0_28px_80px_rgba(0,0,0,.4)] ${
            isMobile ? "rounded-[24px]" : dockMode === "expanded" ? "rounded-[24px]" : useSideRail ? "rounded-e-[24px] border-s-0" : "rounded-[24px]"
          }`}
          style={panelStyle}
          role="dialog"
          aria-label={t("astroAI")}
        >
          <div
            onPointerDown={dockMode === "expanded" && !isMobile ? startDrag("move") : undefined}
            className={`flex items-center gap-2.5 border-b border-[var(--divider-subtle)] px-5 py-4 shrink-0 ${dockMode === "expanded" && !isMobile ? "cursor-grab active:cursor-grabbing" : ""}`}
          >
            {!isMobile && dockMode === "expanded" && <GripVertical size={15} className="text-ink/50 shrink-0" />}
            <AstroIcon className="h-8 w-8 text-brand shrink-0" />
            <span className="font-semibold text-base">{t("astroAI")}</span>
            <span className="text-[9px] font-black uppercase tracking-[0.1em] text-brand bg-brand/10 px-2 py-0.5 rounded-full leading-none">{t("beta")}</span>
            <span className="flex-1" />
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 transition-colors hover:bg-surface-raised"
                aria-label={t("astroMenu")}
              >
                <MoreVertical size={16} strokeWidth={2.5} />
              </button>
              {menuOpen && (
                <div className="absolute end-0 top-10 z-10 w-48 rounded-[16px] border border-ring bg-surface p-2 text-sm font-semibold shadow-[0_18px_46px_rgba(0,0,0,.22)]">
                  <button type="button" onClick={() => { clearMessages(); setMenuOpen(false); }} className="block w-full rounded-[10px] px-3 py-2 text-start text-ink-muted hover:bg-surface-2 hover:text-ink">
                    {t("newChat")}
                  </button>
                  {aboutHref && renderLink({
                    href: aboutHref,
                    onClick: () => setMenuOpen(false),
                    children: t("aboutAstro"),
                    className: "block w-full rounded-[10px] px-3 py-2 text-start text-ink-muted hover:bg-surface-2 hover:text-ink",
                  })}
                  {!isMobile && dockMode === "peek" && (
                    <button type="button" onClick={() => { setDockMode("expanded", true); setMenuOpen(false); }} className="block w-full rounded-[10px] px-3 py-2 text-start text-ink-muted hover:bg-surface-2 hover:text-ink">
                      {t("expandPanel")}
                    </button>
                  )}
                  <button type="button" onClick={() => { closeAstro(); setTimeout(() => setOff(true), 300); setMenuOpen(false); }} className="block w-full rounded-[10px] px-3 py-2 text-start text-ink-muted hover:bg-surface-2 hover:text-ink">
                    {t("turnOffAstro")}
                  </button>
                </div>
              )}
            </div>
            {!isMobile && (
              <button
                type="button"
                onClick={() => setDockMode(dockMode === "expanded" ? "peek" : "expanded", true)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 transition-colors hover:bg-surface-raised"
                aria-label={dockMode === "expanded" ? t("reattachToSide") : t("detachMoveResize")}
                title={dockMode === "expanded" ? t("reattachToSide") : t("detachMoveResize")}
              >
                {dockMode === "expanded" ? <Minimize2 size={15} strokeWidth={2.5} /> : <Maximize2 size={15} strokeWidth={2.5} />}
              </button>
            )}
            <button
              type="button"
              onClick={closeAstro}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 transition-colors hover:bg-surface-raised"
              aria-label={t("close")}
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0">
            {messages.length === 0 && !loading && (
              <div className="mt-3 flex flex-col gap-3">
                <p className="text-sm text-ink-muted">
                  {productContext
                    ? tp("astroGreetingWithProduct", { product: productContext.name })
                    : t("astroGreeting")}
                </p>
                <div className="flex flex-col gap-1.5">
                  {(productContext ? productChips : chips).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendQuestion(q)}
                      className="group flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-start text-xs font-semibold text-ink transition-colors hover:bg-brand/10 hover:text-brand"
                    >
                      <AstroIcon className="h-3.5 w-3.5 shrink-0 text-brand" />
                      <span className="flex-1">{q}</span>
                      <span className="text-ink/50 transition-colors group-hover:text-brand">&#8250;</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) =>
              msg.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="bg-brand text-white rounded-[18px] rounded-te-[6px] px-4 py-2.5 text-sm max-w-[80%] shadow-sm">
                    {msg.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="bg-surface-2 text-ink rounded-[18px] rounded-ts-[6px] px-4 py-2.5 text-sm max-w-[86%] shadow-sm">
                    {renderMessageText(msg.text, renderLink, renderImage, closeAstro)}
                    {msg.links && msg.links.length > 0 && (
                      <div className="mt-3 grid gap-2">
                        {msg.links.map((link) => (
                          <React.Fragment key={link.href}>
                            {renderLink({
                              href: link.href,
                              onClick: closeAstro,
                              className: "group flex items-center gap-3 rounded-xl border border-[var(--divider-subtle)] bg-surface px-3 py-2 text-xs font-bold text-ink transition-colors hover:border-brand/40 hover:text-brand",
                              children: (
                                <>
                                  {link.image && renderImage
                                    ? React.createElement(renderImage, { src: link.image, alt: link.label, className: "h-10 w-10 shrink-0 rounded-lg object-cover" })
                                    : link.image
                                      ? <img src={link.image} alt={link.label} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                                      : (
                                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/8 text-[10px] font-black uppercase tracking-[0.08em] text-brand">
                                          {link.label.split(/\s+/).slice(0, 2).map((word) => word[0]).join("") || "HR"}
                                        </span>
                                      )
                                  }
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate">View {link.label}</span>
                                    {displayPrice(link.price) && (
                                      <span className="mt-0.5 block text-[11px] font-semibold text-ink-muted">
                                        {displayPrice(link.price)}
                                      </span>
                                    )}
                                  </span>
                                  <span className="shrink-0 text-ink/40 transition-colors group-hover:text-brand">&#8250;</span>
                                </>
                              ),
                            })}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                    {i === lastAssistantIndex && !loading && (
                    <div className="mt-3 flex flex-col gap-2 border-t border-[var(--divider-subtle)] pt-3">
                      <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void sendFeedback(i, "up")}
                        className="grid h-7 w-7 place-items-center rounded-full bg-surface text-ink/45 transition-colors hover:text-brand"
                        aria-label={t("helpfulResponse")}
                      >
                        <ThumbsUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFeedbackOpenFor(i);
                          setFeedbackReason("");
                        }}
                        className="grid h-7 w-7 place-items-center rounded-full bg-surface text-ink/45 transition-colors hover:text-brand"
                        aria-label={t("unhelpfulResponse")}
                      >
                        <ThumbsDown size={14} />
                      </button>
                      {feedbackStatus === "thanks" && (
                        <span className="text-[11px] font-semibold text-brand">{t("thanksForFeedback")}</span>
                      )}
                      {feedbackStatus === "error" && (
                        <span className="text-[11px] font-semibold text-ink-muted">{t("couldNotSaveTryAgain")}</span>
                      )}
                      </div>
                    {feedbackOpenFor === i && (
                      <div className="mt-3 rounded-[14px] border border-ring bg-surface p-3">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/55">{t("whatWentWrong")}</p>
                        <div className="mt-2 grid gap-2">
                          {[
                            { value: "inaccurate", label: t("inaccurate") },
                            { value: "harmful/unsafe", label: t("harmfulUnsafe") },
                            { value: "irrelevant", label: t("irrelevant") },
                            { value: "something else", label: t("somethingElse") },
                          ].map((reason) => (
                            <label key={reason.value} className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink-muted">
                              <input type="radio" name={`astro-feedback-${i}`} value={reason.value} checked={feedbackReason === reason.value} onChange={() => setFeedbackReason(reason.value)} />
                              {reason.label}
                            </label>
                          ))}
                        </div>
                        <div className="mt-3 flex justify-end gap-2">
                          <button type="button" onClick={() => setFeedbackOpenFor(null)} className="text-xs font-black uppercase tracking-[0.1em] text-ink/45 hover:text-brand">
                            {t("dismiss")}
                          </button>
                          <button
                            type="button"
                            disabled={!feedbackReason}
                            onClick={() => {
                              void sendFeedback(i, "down", feedbackReason);
                              setFeedbackOpenFor(null);
                            }}
                            className="rounded-[10px] bg-ink px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-bg disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            {t("submit")}
                          </button>
                        </div>
                      </div>
                    )}
                    </div>
                    )}
                    {addToCart && msg.showAddToCart && productContext?.productId && productContext.price !== undefined &&
                      i === messages.length - 1 &&
                      messages.filter((m) => m.role === "user").length >= 3 && (
                        <div className="mt-3 pt-3 border-t border-[var(--divider-subtle)]">
                          <button
                            type="button"
                            onClick={() => {
                              addToCart(
                                {
                                  id: productContext.productId!,
                                  name: productContext.name,
                                  price: productContext.price!,
                                  quantity: 1,
                                  image: productContext.image || "",
                                },
                                { openCart: true },
                              );
                              setCartedFromChat(true);
                              setTimeout(() => setCartedFromChat(false), 2500);
                            }}
                            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-all ${
                              cartedFromChat
                                ? "bg-green-500/15 text-green-600"
                                : (productContext.price ?? 0) <= 0
                                  ? "bg-emerald-600 text-white hover:bg-emerald-50 hover:text-emerald-900"
                                  : "bg-brand text-white hover:opacity-90"
                            }`}
                          >
                            <ShoppingCart size={14} strokeWidth={2.5} />
                            {cartedFromChat
                              ? t("addedToCart")
                              : (productContext.price ?? 0) <= 0
                                ? t("claimFree")
                                : formatPrice
                                  ? tp("addToCartWithPrice", { price: formatPrice(productContext.price!) })
                                  : t("addToCartWithPrice").replace("{price}", `${productContext.price!}`)
                            }
                          </button>
                        </div>
                      )}

                    {i === messages.length - 1 && ((msg.actions?.length ?? 0) > 0 || (msg.followUps?.length ?? 0) > 0) && (
                      <div className="mt-3 space-y-1.5 border-t border-[var(--divider-subtle)] pt-3">
                        {msg.actions?.slice(0, 3).map((action) => {
                          const className = "flex w-full items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-start text-xs font-semibold text-ink transition-colors hover:bg-brand/8 hover:text-brand disabled:opacity-40 group";
                          if (action.type === "view_product") {
                            return (
                              <React.Fragment key={`${action.type}-${action.label}`}>
                                {renderLink({
                                  href: action.href,
                                  onClick: () => store.getState().trackEvent?.("astro_action_click", { type: action.type, label: action.label, slug: action.slug }),
                                  className,
                                  children: (
                                    <>
                                      <span className="flex-1">{action.label}</span>
                                      <span className="shrink-0">&#8250;</span>
                                    </>
                                  ),
                                })}
                              </React.Fragment>
                            );
                          }

                          return (
                            <button
                              key={`${action.type}-${action.label}`}
                              type="button"
                              disabled={loading}
                              onClick={() => {
                                store.getState().trackEvent?.("astro_action_click", { type: action.type, label: action.label });
                                if (action.type === "ask_followup" || action.type === "compare_products") {
                                  sendQuestion(action.question);
                                } else if (action.type === "open_cart") {
                                  window.dispatchEvent(new CustomEvent("hrnt:open-cart"));
                                } else if (action.type === "add_to_cart" && addToCart && productContext?.productId && productContext.price !== undefined) {
                                  addToCart(
                                    {
                                      id: productContext.productId,
                                      name: productContext.name,
                                      price: productContext.price,
                                      quantity: 1,
                                      image: productContext.image || "",
                                    },
                                    { openCart: true },
                                  );
                                  setCartedFromChat(true);
                                  setTimeout(() => setCartedFromChat(false), 2500);
                                }
                              }}
                              className={className}
                            >
                              <span className="flex-1">{action.label}</span>
                              <span className="shrink-0">&#8250;</span>
                            </button>
                          );
                        })}
                        {msg.followUps?.slice(0, 3).map((followUp) => (
                          <button
                            key={followUp}
                            type="button"
                            onClick={() => sendQuestion(followUp)}
                            disabled={loading}
                            className="flex w-full items-center gap-2 rounded-xl bg-surface px-3 py-2 text-start text-xs font-semibold text-ink transition-all hover:bg-brand/8 hover:text-brand disabled:opacity-40 group"
                          >
                            <span className="flex-1">{followUp}</span>
                            <span className="text-ink/50 group-hover:text-brand transition-colors shrink-0">&#8250;</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-surface-2 text-ink-muted rounded-[18px] rounded-ts-[6px] px-4 py-3 flex items-center gap-2 text-sm shadow-sm">
                  <span>{t("thinking")}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-muted animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-muted animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-muted animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); sendQuestion(inputValue); setInputValue(""); }}
            className="flex flex-col gap-2 px-4 py-3 border-t border-[var(--divider-subtle)] shrink-0"
          >
            {selectedContext && (
              <span className="flex max-w-full items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink-muted">
                <span className="truncate">{tp("contextLabel", { text: selectedContext })}</span>
                <button type="button" onClick={() => setSelectedContext("")} className="text-ink/40 hover:text-brand" aria-label={t("close")}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                aria-label={t("askAQuestion")}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={messages.length > 0 ? t("askAFollowUp") : t("askAnything")}
                disabled={loading}
                className="flex-1 bg-surface-2 rounded-full px-4 py-2 text-sm outline-none placeholder:text-ink-muted disabled:opacity-50 transition-opacity"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || loading}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-brand text-white disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
                aria-label={t("send")}
              >
                <Send size={15} strokeWidth={2.5} />
              </button>
            </div>
          </form>

          {!isMobile && dockMode === "expanded" && (
            <div
              onPointerDown={startDrag("resize")}
              className="absolute end-0 top-0 h-full w-2 cursor-ew-resize"
              aria-hidden="true"
            />
          )}
        </div>
      )}
    </>
  );
};
