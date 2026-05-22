import type { AstroChatRequest, AstroChatResponse, AstroAction, AstroLink, AstroSite, AstroStreamEvent } from "./types";

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

/** Stream a chat request using Server-Sent Events */
export async function streamAstroChat(
  request: AstroChatRequest,
  onEvent: (event: AstroStreamEvent) => void,
  endpoint?: string,
): Promise<void> {
  const base = endpoint || DEFAULT_ENDPOINT;
  const separator = base.includes("?") ? "&" : "?";
  const res = await fetch(`${base}${separator}stream=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed with status ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream")) {
    const data = await res.json() as AstroChatResponse;
    onEvent({ type: "done", answer: data.answer, followUps: data.followUps, links: data.links, showAddToCart: data.showAddToCart, actions: data.actions });
    return;
  }

  if (!res.body) {
    throw new Error("No response body for streaming");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";

    for (const block of blocks) {
      if (!block.trim()) continue;

      let dataStr = "";

      for (const line of block.split("\n")) {
        if (line.startsWith("data: ")) {
          dataStr = line.slice(6);
        } else if (line.startsWith("event: ")) {
          // Backend doesn't send event: lines, but handle gracefully
        }
      }

      if (!dataStr) continue;

      try {
        const data = JSON.parse(dataStr) as Record<string, unknown>;

        if (typeof data.token === "string") {
          onEvent({ type: "token", content: data.token });
        } else if (data.done === true) {
          onEvent({
            type: "done",
            answer: (data.answer as string) || "",
            followUps: data.followUps as string[] | undefined,
            links: data.links as AstroLink[] | undefined,
            showAddToCart: data.showAddToCart as boolean | undefined,
            actions: data.actions as AstroAction[] | undefined,
          });
        } else if (typeof data.agentStatus === "string") {
          onEvent({ type: "agentStatus", status: data.agentStatus });
        } else if (data.revision === true && typeof data.answer === "string") {
          onEvent({ type: "revision", answer: data.answer });
        } else if (data.handoff === true && typeof data.message === "string") {
          onEvent({ type: "handoff", message: data.message });
        } else if (typeof data.error === "string") {
          onEvent({ type: "error", message: data.error });
        }
      } catch {
        // Skip malformed events
      }
    }
  }
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
