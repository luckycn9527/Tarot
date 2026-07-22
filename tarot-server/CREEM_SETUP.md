# Creem Payment Setup

The application keeps payments disabled until `CREEM_ENABLED=true` and all required values are present. Never put a Creem API key or webhook secret in frontend code.

## 1. Create the merchant account

Sign up at https://www.creem.io/ using the business owner's email address and complete the verification steps in the Creem dashboard. Account verification and payout details must be completed by the account owner.

## 2. Create two recurring products

In the Creem dashboard, create active recurring products with the following initial pricing:

| Plan | Billing period | Price | Environment key |
| --- | --- | --- | --- |
| VIP Monthly | every month | USD 9.90 | `CREEM_MONTHLY_PRODUCT_ID` |
| VIP Yearly | every year | USD 89.90 | `CREEM_YEARLY_PRODUCT_ID` |

Use the same currency and amounts in the environment values below. Copy each product ID from the product detail page.

## 3. Add a Webhook

Create a webhook that points to:

```
https://tarot.zaopic.cn/api/payments/webhook
```

Subscribe to at least these events:

```
checkout.completed
subscription.active
subscription.paid
subscription.trialing
subscription.scheduled_cancel
subscription.canceled
subscription.expired
subscription.update
refund.created
dispute.created
```

Copy the webhook secret. The server validates the `creem-signature` HMAC-SHA256 header against the raw request body and ignores duplicate event IDs.

## 4. Configure the production server

Add these values to `tarot-server/.env` on the server. Use test API keys and `https://test-api.creem.io` first; switch both key and API base URL to production together.

```env
CREEM_ENABLED=true
CREEM_API_KEY=creem_your_api_key
CREEM_WEBHOOK_SECRET=your_webhook_secret
CREEM_API_BASE_URL=https://api.creem.io
CREEM_MONTHLY_PRODUCT_ID=prod_monthly_id
CREEM_YEARLY_PRODUCT_ID=prod_yearly_id
CREEM_MONTHLY_PRICE_CENTS=990
CREEM_YEARLY_PRICE_CENTS=8990
CREEM_CURRENCY=USD
```

Run the migration and restart the API after updating the configuration:

```bash
cd tarot-server
npm run migrate:all
pm2 reload tarot-api --update-env
```

## 5. Test before live payments

1. Keep `CREEM_API_BASE_URL=https://test-api.creem.io` and use Creem test-mode product IDs.
2. Complete a sandbox checkout while signed into a test account.
3. Confirm the webhook reaches `/api/payments/webhook`, the member becomes VIP, and the expiry matches the Creem subscription period.
4. Use the membership page to schedule cancellation and confirm benefits stay active until the current period ends.
