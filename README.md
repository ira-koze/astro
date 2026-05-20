# @hrnt/astro-assistant

Shared AI assistant component for the HRNT ecosystem.

## Installation

```bash
npm install @hrnt/astro-assistant
```

## Peer Dependencies

- react >=18.0.0
- react-dom >=18.0.0
- zustand >=4.0.0
- lucide-react >=0.300.0

## Usage

```tsx
import { AstroDock, AstroDockProvider, createAstroStore } from "@hrnt/astro-assistant";
import "@hrnt/astro-assistant/astro-assistant.css";

// Create a store instance
const store = createAstroStore("shop", {
  apiEndpoint: "https://your-api.com/api/astro/chat",
  trackEvent: (event, props) => {
    // Your analytics tracking
  },
});

// Wrap your app
function App() {
  return (
    <AstroDockProvider store={store}>
      <YourApp />
      <AstroDock />
    </AstroDockProvider>
  );
}
```

## Exports

- `createAstroStore` - Create a Zustand store for Astro state
- `AstroDock` - Main UI component
- `AstroDockProvider` - Context provider
- `useAstroDockContext` - Access Astro context
- `AstroIcon` - Astro logo icon component
- `getKbPrompt` - Get knowledge base prompt for a site
- Cookie utilities: `getAstroOff`, `setAstroOff`, `getAstroDockGeom`, `setAstroDockGeom`
- API functions: `sendAstroChat`, `sendAstroFeedback`, `saveAstroHistory`
- Types: `AstroSite`, `AstroDockMode`, `AstroDockGeom`, `AstroProductContext`, `AstroLink`, `AstroMessage`, `AstroChatRequest`, `AstroChatResponse`, `AstroSiteConfig`

## Sites

Supported site types:
- `shop` - E-commerce site
- `portfolio` - Portfolio site
- `bio` - Link hub
- `docs` - Documentation site
- `booking` - Booking system

## License

UNLICENSED
