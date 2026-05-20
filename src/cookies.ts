const DOMAIN = ".irakozehornet.com";
const COOKIE_NAME = "hrnt_astro_off";
const LOCAL_KEY = "hrnt_astro_off";

/** Read the off state from cross-domain cookie, falling back to localStorage */
export function getAstroOff(): boolean {
  if (typeof window === "undefined") return false;
  const cookieMatch = document.cookie.match(/(?:^|;\s*)hrnt_astro_off=([^;]*)/);
  if (cookieMatch) return cookieMatch[1] === "yes";
  const local = localStorage.getItem(LOCAL_KEY);
  if (local === "yes") {
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
  localStorage.removeItem(LOCAL_KEY);
}

function setAstroOffCookie(off: boolean): void {
  if (off) {
    document.cookie = `${COOKIE_NAME}=yes; domain=${DOMAIN}; path=/; max-age=31536000; Secure; SameSite=Lax`;
  } else {
    document.cookie = `${COOKIE_NAME}=no; domain=${DOMAIN}; path=/; max-age=0; Secure; SameSite=Lax`;
  }
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
