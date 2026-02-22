# Auto Product Tagger (MVP)

A Shopify app for automatically tagging products based on configurable rules. Create rules that match products by vendor, price, title, and other criteria, then automatically apply tags in bulk or react to product changes in real-time.

## Development

### Prerequisites

- Node.js 18+
- Shopify CLI installed
- A Shopify development store

### Local development

```bash
npm run dev
```

Open the embedded app in your Shopify Admin to start testing.

### Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

### Local testing helpers

- `npm run uat:seed` - Seed one sample MVP rule for testing
- `npm run uat:reset` - Clear all rules and runs
- `npm run lint && npm run typecheck` - Run all static checks
