const DOMAIN = ".irakozehornet.com";
const COOKIE_NAME = "hrnt_astro_off";
const LOCAL_KEY = "hrnt_astro_off";
const CONV_COOKIE = "hrnt_astro_conv";

/** Read the off state from cross-domain cookie, falling back to localStorage */
export function getAstroOff(): boolean {
  if (typeof window === "undefined") return false;
  // Check cookie first (cross-domain)
  const cookieMatch = document.cookie.match(/(?:^|;\s*)hrnt_astro_off=([^;]*)/);
  if (cookieMatch) return cookieMatch[1] === "yes";
  // Fallback to localStorage for backward compat
  const local = localStorage.getItem(LOCAL_KEY);
  if (local === "yes") {
    // Migrate to cookie
    setAstroOffCookie(true);
    localStorage.removeItem(LOCAL_KEY);
    return true;
  }
  return false;
}

/** Set the off state using a cross-domain cookie */
export function setAstroOff(off: boolean): void {
  if (typeof window === "undefined") return;
  setAstroOffCookie(off);
  // Also clear localStorage if migrating
  localStorage.removeItem(LOCAL_KEY);
}

function setAstroOffCookie(off: boolean): void {
  if (off) {
    document.cookie = `${COOKIE_NAME}=yes; domain=${DOMAIN}; path=/; max-age=31536000; Secure; SameSite=Lax`;
  } else {
    document.cookie = `${COOKIE_NAME}=no; domain=${DOMAIN}; path=/; max-age=0; Secure; SameSite=Lax`;
  }
}

/** Get or create a persistent conversation ID (cross-domain cookie, 1 year) */
export function getOrCreateConversationId(): string {
  if (typeof window === "undefined") return "server";

  const cookieMatch = document.cookie.match(new RegExp(`(?:^|;\\s*)${CONV_COOKIE}=([^;]*)`));
  if (cookieMatch && cookieMatch[1]) return cookieMatch[1];

  const newId = `astro_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  document.cookie = `${CONV_COOKIE}=${newId}; domain=${DOMAIN}; path=/; max-age=31536000; Secure; SameSite=Lax`;

  const sessionKey = "hrnt_astro_conversation_id";
  const sessionId = sessionStorage.getItem(sessionKey);
  if (sessionId) {
    document.cookie = `${CONV_COOKIE}=${sessionId}; domain=${DOMAIN}; path=/; max-age=31536000; Secure; SameSite=Lax`;
    return sessionId;
  }

  sessionStorage.setItem(sessionKey, newId);
  return newId;
}

/** Reset conversation ID (on "New chat") — generates a new persistent ID */
export function resetConversationId(): string {
  if (typeof window === "undefined") return "server";

  document.cookie = `${CONV_COOKIE}=; domain=${DOMAIN}; path=/; max-age=0; Secure; SameSite=Lax`;
  return getOrCreateConversationId();
}

/** Read dock geometry from localStorage (site-specific, correct behavior) */
export function getAstroDockGeom(): { side: "left" | "right"; x: number; y: number; width: number; mode: "collapsed" | "peek" | "expanded" } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("hrnt_astro_dock");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Persist dock geometry to localStorage */
export function setAstroDockGeom(geom: { side: "left" | "right"; x: number; y: number; width: number; mode: "collapsed" | "peek" | "expanded" }): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("hrnt_astro_dock", JSON.stringify(geom));
}
