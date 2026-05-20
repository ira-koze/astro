import React, { createContext, useContext, useMemo, useRef } from "react";
import { createAstroStore } from "./store";
import type { AstroSite } from "./types";
import { DEFAULT_STRINGS, DEFAULT_CHIPS, DEFAULT_PRODUCT_CHIPS } from "./strings";

export type AstroStoreHook = ReturnType<typeof createAstroStore>;

export interface RenderLinkProps {
  href: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export interface RenderImageProps {
  src: string;
  alt: string;
  className?: string;
}

export interface AstroDockContextValue {
  store: AstroStoreHook;
  t: (key: string) => string;
  tp: (key: string, params: Record<string, string | number>) => string;
  renderLink: (props: RenderLinkProps) => React.ReactNode;
  renderImage?: (props: RenderImageProps) => React.ReactNode;
  addToCart?: (item: { id: string; name: string; price: number; quantity: number; image: string }, options?: { openCart?: boolean }) => void;
  formatPrice?: (price: number) => string;
  aboutHref?: string;
  chips: string[];
  productChips: string[];
  shouldTriggerHelp?: () => boolean;
  dismissHelp?: () => void;
}

export const AstroDockContext = createContext<AstroDockContextValue | null>(null);

export function useAstroDockContext(): AstroDockContextValue {
  const ctx = useContext(AstroDockContext);
  if (!ctx) throw new Error("AstroDock must be used within <AstroDockProvider>");
  return ctx;
}

const defaultT = (key: string): string => DEFAULT_STRINGS[key] ?? key;

const defaultTp = (key: string, params: Record<string, string | number>): string => {
  const template = DEFAULT_STRINGS[key] ?? key;
  return Object.entries(params).reduce(
    (str, [k, v]) => str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v)),
    template,
  );
};

const defaultRenderLink = ({ href, onClick, children, className }: RenderLinkProps) => (
  <a href={href} onClick={onClick} className={className}>
    {children}
  </a>
);

const defaultRenderImage = ({ src, alt, className }: RenderImageProps) => (
  <img src={src} alt={alt} className={className} />
);

export interface AstroDockProviderProps {
  /** Pass an existing store to reuse it across components (e.g. from a module-level createAstroStore call). */
  store?: AstroStoreHook;
  /** Required when store is not provided. */
  site?: AstroSite;
  apiEndpoint?: string;
  trackEvent?: (event: string, properties?: Record<string, unknown>) => void;
  t?: (key: string) => string;
  tp?: (key: string, params: Record<string, string | number>) => string;
  renderLink?: (props: RenderLinkProps) => React.ReactNode;
  renderImage?: (props: RenderImageProps) => React.ReactNode;
  addToCart?: (item: { id: string; name: string; price: number; quantity: number; image: string }, options?: { openCart?: boolean }) => void;
  formatPrice?: (price: number) => string;
  aboutHref?: string;
  chips?: string[];
  productChips?: string[];
  shouldTriggerHelp?: () => boolean;
  dismissHelp?: () => void;
  children: React.ReactNode;
}

export function AstroDockProvider({
  store: externalStore,
  site,
  apiEndpoint,
  trackEvent,
  t,
  tp,
  renderLink,
  renderImage,
  addToCart,
  formatPrice,
  aboutHref,
  chips,
  productChips,
  shouldTriggerHelp,
  dismissHelp,
  children,
}: AstroDockProviderProps) {
  const storeRef = useRef(externalStore ?? null);
  if (!storeRef.current) {
    if (!site) throw new Error("AstroDockProvider requires either 'store' or 'site'");
    storeRef.current = createAstroStore(site, { apiEndpoint, trackEvent });
  }
  const store = storeRef.current;

  const value = useMemo(
    () => ({
      store,
      t: t ?? defaultT,
      tp: tp ?? defaultTp,
      renderLink: renderLink ?? defaultRenderLink,
      renderImage: renderImage ?? defaultRenderImage,
      addToCart,
      formatPrice,
      aboutHref,
      chips: chips ?? DEFAULT_CHIPS,
      productChips: productChips ?? DEFAULT_PRODUCT_CHIPS,
      shouldTriggerHelp,
      dismissHelp,
    }),
    // store is stable (created once), no need to include in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, t, tp, renderLink, renderImage, addToCart, formatPrice, aboutHref, chips, productChips, shouldTriggerHelp, dismissHelp],
  );

  return (
    <AstroDockContext.Provider value={value}>
      {children}
    </AstroDockContext.Provider>
  );
}
