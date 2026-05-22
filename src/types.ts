/** Site identifier for context-specific behavior */
export type AstroSite = "shop" | "portfolio" | "bio" | "docs" | "booking";

/** Dock visual state */
export type AstroDockMode = "collapsed" | "peek" | "expanded";

/** Dock geometry for the expanded resizable panel */
export interface AstroDockGeom {
  side: "left" | "right";
  x: number;
  y: number;
  width: number;
  mode: AstroDockMode;
}

/** Product/context information sent to the API */
export interface AstroProductContext {
  productId?: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  specs?: { name: string; value: string }[];
  price?: number;
  regularPrice?: number;
  image?: string;
  relatedProducts?: {
    label: string;
    href: string;
    slug?: string;
    image?: string;
    price?: number;
    regularPrice?: number;
  }[];
  pageKind?: string;
  pathnameHint?: string;
  selectedContext?: string;
  rating?: number;
  reviewCount?: number;
  sold?: number;
  reviewSummary?: string;
  intentContext?: unknown;
}

/** A link shown in assistant responses */
export interface AstroLink {
  label: string;
  href: string;
  slug?: string;
  image?: string;
  price?: number;
  regularPrice?: number;
}

export type AstroAction =
  | { type: "view_product"; label: string; href: string; slug?: string }
  | { type: "compare_products"; label: string; question: string }
  | { type: "add_to_cart"; label: string; productId?: string; slug?: string }
  | { type: "open_cart"; label: string }
  | { type: "ask_followup"; label: string; question: string };

/** A single chat message */
export interface AstroMessage {
  role: "user" | "assistant";
  text: string;
  links?: AstroLink[];
  followUps?: string[];
  actions?: AstroAction[];
  showAddToCart?: boolean;
  handoffMessage?: string;
}

/** Configuration provided by each site */
export interface AstroSiteConfig {
  site: AstroSite;
  apiEndpoint?: string;
  getContext?: () => AstroProductContext | null;
  trackEvent?: (event: string, properties?: Record<string, unknown>) => void;
  addToCart?: (slug: string) => void;
  formatPrice?: (price: number, regularPrice?: number) => string;
  t?: (key: string) => string;
}

/** API request body */
export interface AstroChatRequest {
  question: string;
  locale: string;
  site: AstroSite;
  conversationId?: string;
  productContext: AstroProductContext | { name: string; category: string; selectedContext?: string; pageKind?: string; pathnameHint?: string };
  messages?: { role: "user" | "assistant"; text: string }[];
  cartItems?: { id?: string; slug?: string; name: string; category?: string; price?: number }[];
}

/** API response body */
export interface AstroChatResponse {
  answer: string;
  links?: AstroLink[];
  followUps?: string[];
  actions?: AstroAction[];
  showAddToCart?: boolean;
  unavailable?: true;
}

/** Streaming event from the Astro API */
export type AstroStreamEvent =
  | { type: "token"; content: string }
  | { type: "done"; answer: string; followUps?: string[]; links?: AstroLink[]; showAddToCart?: boolean; actions?: AstroAction[] }
  | { type: "replace"; answer: string; followUps?: string[]; links?: AstroLink[]; showAddToCart?: boolean; actions?: AstroAction[] }
  | { type: "agentStatus"; status: string }
  | { type: "revision"; answer: string }
  | { type: "handoff"; message: string }
  | { type: "error"; message: string };
