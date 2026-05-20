import type { AstroChatRequest, AstroChatResponse, AstroSite } from "./types";

const DEFAULT_ENDPOINT = "https://shop.irakozehornet.com/api/astro/chat";

/** Send a chat request to the Astro API */
export async function sendAstroChat(
  request: AstroChatRequest,
  endpoint?: string,
): Promise<AstroChatResponse> {
  const url = endpoint || DEFAULT_ENDPOINT;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed with status ${res.status}`);
  }

  return res.json();
}

/** Send feedback to the Astro API */
export async function sendAstroFeedback(
  payload: {
    conversationId: string;
    site: AstroSite;
    productId?: string;
    productName?: string;
    value: "up" | "down";
    reason?: string;
    message: string;
  },
  endpoint?: string,
): Promise<boolean> {
  const url = (endpoint || DEFAULT_ENDPOINT).replace(/\/chat$/, "/feedback");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Save chat history to the Astro API */
export async function saveAstroHistory(
  payload: {
    conversationId: string;
    site: AstroSite;
    messages: { role: string; text: string }[];
  },
  endpoint?: string,
): Promise<boolean> {
  const url = (endpoint || DEFAULT_ENDPOINT).replace(/\/chat$/, "/history");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
