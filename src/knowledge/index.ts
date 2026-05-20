import type { AstroSite } from "../types";
import { SHOP_KB_PROMPT } from "./shop";
import { PORTFOLIO_KB_PROMPT } from "./portfolio";
import { BIO_KB_PROMPT } from "./bio";
import { DOCS_KB_PROMPT } from "./docs";
import { BOOKING_KB_PROMPT } from "./booking";

const KB_PROMPTS: Record<AstroSite, string> = {
  shop: SHOP_KB_PROMPT,
  portfolio: PORTFOLIO_KB_PROMPT,
  bio: BIO_KB_PROMPT,
  docs: DOCS_KB_PROMPT,
  booking: BOOKING_KB_PROMPT,
};

/** Get the system prompt fragment for a given site */
export function getKbPrompt(site: AstroSite): string {
  return KB_PROMPTS[site];
}
