# Sales Grading Agent

A restaurant-first sales assistant that matches customer requests to a verified menu, builds an editable cart, and prepares an order for customer-initiated WhatsApp handoff.

## Current prototype

The current menu, restaurant name, prices, and imagery are demonstration data. Replace them with merchant-approved facts before a customer pilot.

Jev makes two bounded decisions: the closest eligible menu item and whether the request needs clarification. The application owns menu IDs, quantities, prices, totals, fulfillment labels, and WhatsApp message construction.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set `TYPESAFE_API_KEY` to the Jev key. Keep it server-side and out of commits.
3. Set `NEXT_PUBLIC_WHATSAPP_NUMBER` to the restaurant number in international digits-only format when available.
4. Install dependencies from the public npm registry and run the development server:

```bash
NPM_CONFIG_REGISTRY=https://registry.npmjs.org npm install
npm run dev
```

Without a Jev key, the recommendation endpoint uses a clearly limited local keyword matcher so the interface remains testable. Without a WhatsApp number, the handoff button copies the sample order message.

## Transaction boundary

Opening WhatsApp does not place, accept, or pay for an order. The restaurant must confirm availability, final total, fulfillment, payment, and estimated time. Delivery fees remain unknown until confirmed.

## Configuration

- `TYPESAFE_API_KEY`: server-side TypeSafe API credential.
- `TYPESAFE_API_URL`: defaults to the official `https://api.typesafe.ai/v1/systemone` endpoint.
- `NEXT_PUBLIC_WHATSAPP_NUMBER`: restaurant destination in full international digits-only format.
