# VoltEdge Electronics

VoltEdge is a Nigerian electronics storefront built with Next.js, Supabase, and an n8n order workflow. Checkout creates an order request; it does not collect or confirm payment. Prices and stock are reloaded from Supabase on the server.

## Environment

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL` — hosted Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase publishable/anon key. This is safe for browser use when RLS is enabled.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only Supabase service-role key. Never prefix this with `NEXT_PUBLIC_` or expose it in the browser.
- `SUPER_ADMIN_EMAIL` — email address that becomes the first super admin after its first Google sign-in. Only the first profile can be bootstrapped this way.
- `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_TEST_URL`, `N8N_WEBHOOK_SECRET`, and `N8N_ENVIRONMENT` — n8n endpoints and the separate shared secret used only for the n8n integration.
- `ENABLE_MOCK_WEBHOOK` — use `true` for local mock orders; set to `false` when testing the n8n workflow or in production.
- `NEXT_PUBLIC_SITE_URL` — site origin, such as `http://localhost:3000`.

There is no admin password or admin API secret. Admin access comes from a signed-in Supabase user whose server-side `profiles.role` is `admin` or `super_admin`. Google sign-in exchanges its authorization code for a Supabase SSR cookie session; the Next.js `src/proxy.ts` refreshes sessions, while server layouts and API routes validate the cookie and read the current database role. Profile synchronization runs during the OAuth callback, not on each navigation.
Customers must sign in with Google before checkout or order submission. Add `http://localhost:3000/auth/callback` and your deployed `/auth/callback` URL to the Supabase Auth redirect URL allowlist. Existing sessions held only in the previous localStorage session require one fresh sign-in after deploying this change.

## Hosted Supabase setup

The original schema migration (`20261103000000_init_voltedge_schema.sql`) must already be applied. In the Supabase SQL Editor, paste and run the complete single additive migration in [`supabase/migrations/20261104000001_admin_catalogue_and_integrations.sql`](./supabase/migrations/20261104000001_admin_catalogue_and_integrations.sql). It adds customer profiles and lifecycle labels, admin roles, order ownership, VIP and integration settings, RLS policies, and the public-read/admin-write `product-images` storage bucket.

Enable the Google provider in Supabase Auth and allow the local and deployed site origins in the Auth redirect URL allowlist. On the first sign-in for `SUPER_ADMIN_EMAIL`, the server bootstraps that profile as `super_admin`; the super admin can then promote registered users to `admin`.

## n8n workflow alignment

The storefront sends this JSON body to the configured n8n webhook. The `x-voltedge-secret` header contains `N8N_WEBHOOK_SECRET` and must not be echoed or logged. The second header carries the same idempotency key as the body.

```json
{
  "idempotency_key": "11111111-2222-4333-8444-555555555555",
  "submitted_at": "2026-06-18T12:34:56.000Z",
  "source": "storefront-web",
  "user_id": "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  "customer": {
    "name": "Ada Okafor",
    "email": "ada@example.com",
    "phone": "+2348012345678"
  },
  "delivery": {
    "address": "12 Example Road, Lagos",
    "notes": "Call on arrival"
  },
  "items": [
    {
      "product_id": "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
      "name": "VoltEdge Laptop",
      "quantity": 2,
      "unit_price_displayed": 325000,
      "unit_price_client_submitted": 325000,
      "stock_quantity": 8
    }
  ]
}
```

`delivery.address` and `delivery.notes` are omitted when blank; the `delivery` object remains present. `user_id` is the authenticated Supabase user. Customer details remain editable at checkout. The server replaces the submitted product name, displayed price, and stock with current database values; `unit_price_client_submitted` preserves the browser's displayed price for mismatch review. There is no browser-supplied total. `items` contains 1–50 lines, with positive integer quantities. All prices and totals are Naira amounts represented as JSON numbers.

Request headers:

```text
Content-Type: application/json
x-voltedge-secret: <N8N_WEBHOOK_SECRET>
x-idempotency-key: 11111111-2222-4333-8444-555555555555
```

### n8n reply schema

The submit route validates a successful HTTP response against `n8nWebhookReplySchema` in [`src/lib/validations.ts`](./src/lib/validations.ts). Objects are strict: no undocumented properties are accepted. Every accepted, review, or duplicate reply must include `success: true`, a non-empty `order_ref`, an `order_status` matching its outcome, `payment_status: "PAYMENT_PENDING"`, `tags` drawn only from `PAYMENT_PENDING`, `STANDARD_ORDER`, `HIGH_VALUE_ORDER`, `INCOMPLETE_ORDER`, and `REVIEW_REQUIRED`, finite non-negative `total` and `bonus_amount`, a consistent `bonus_status` (`PENDING_VERIFICATION` when the bonus is positive, otherwise `NOT_ELIGIBLE`), and a non-empty `message`. `errors` and `review_reasons` are optional arrays of strings. Accepted replies must include the `PAYMENT_PENDING` tag; review replies must also include `REVIEW_REQUIRED`.

**Accepted** (`HTTP 200`):

```json
{
  "success": true,
  "outcome": "ACCEPTED",
  "order_ref": "VE-20260618-ABCDE",
  "order_status": "PAYMENT_PENDING",
  "payment_status": "PAYMENT_PENDING",
  "tags": ["PAYMENT_PENDING", "STANDARD_ORDER"],
  "total": 325000,
  "bonus_amount": 0,
  "bonus_status": "NOT_ELIGIBLE",
  "message": "Order received. Payment is pending verification."
}
```

**Accepted for review** (`HTTP 200`):

```json
{
  "success": true,
  "outcome": "ACCEPTED_FOR_REVIEW",
  "order_ref": "VE-20260618-FGHIJ",
  "order_status": "REVIEW_REQUIRED",
  "payment_status": "PAYMENT_PENDING",
  "tags": ["PAYMENT_PENDING", "HIGH_VALUE_ORDER", "REVIEW_REQUIRED"],
  "total": 650000,
  "bonus_amount": 32500,
  "bonus_status": "PENDING_VERIFICATION",
  "message": "Order received and queued for manual review.",
  "review_reasons": ["Please confirm item availability."]
}
```

**Rejected/incomplete** (`HTTP 200` from n8n; the storefront submit route responds to the customer with HTTP 422):

```json
{
  "success": false,
  "outcome": "REJECTED_INCOMPLETE",
  "tags": ["INCOMPLETE_ORDER"],
  "message": "The order could not be completed.",
  "errors": ["A required customer detail is missing."],
  "idempotency_key": "11111111-2222-4333-8444-555555555555"
}
```

A repeated idempotency key may return `outcome: "DUPLICATE"` using the accepted reply shape, with `order_status: "PAYMENT_PENDING"`. Any accepted/review/duplicate reply that reports payment as confirmed, uses legacy tags/statuses, or fails the schema is rejected as an invalid n8n reply. The submit API distinguishes `N8N_UNREACHABLE`, `N8N_HTTP_ERROR`, and `N8N_INVALID_REPLY`; response bodies from n8n are not exposed to customers. Validation issue paths and codes are logged server-side with the idempotency key.

**Duplicate** (`HTTP 200`, same accepted-reply fields):

```json
{
  "success": true,
  "outcome": "DUPLICATE",
  "order_ref": "VE-20260618-ABCDE",
  "order_status": "PAYMENT_PENDING",
  "payment_status": "PAYMENT_PENDING",
  "tags": ["PAYMENT_PENDING", "STANDARD_ORDER"],
  "total": 325000,
  "bonus_amount": 0,
  "bonus_status": "NOT_ELIGIBLE",
  "message": "This idempotency key already has an order."
}
```

Submission is never payment. n8n must return `PAYMENT_PENDING` and must not activate a bonus on order submission. The 5% bonus for qualifying orders remains pending until payment is independently verified; admin payment verification is a separate action.

## Run and verify

```bash
npm install
npm run dev
npm run build
npm run lint
```

`scripts/verify-scenarios.mjs` targets `http://localhost:3005`; start the dev server with `npm run dev -- --hostname 0.0.0.0 --port 3005` before running it.
