# Resolve: Interface Assumptions for Orbyte

This page explains how Resolve would connect to Orbyte and to real review channels. Everything here describes our assumptions about the Orbyte side. The Resolve side is built and running in the demo.

## 1. One way in: the review-received event

Every review enters Resolve through one endpoint, whatever the channel (NFC card, QR code, Google Business Profile, WhatsApp).

```
POST /api/events/review-received
Content-Type: application/json

{
  "outletId": "bangsar",       // the outlet slug printed on the QR code
  "alias": "Aina",             // first name or alias only (PDPA)
  "rating": 2,                 // 1 to 5
  "text": "Waited 35 minutes for two coffees."   // 1 to 500 characters
}
```

Response `201`: `{ alias, rating, text, date, posted_reply: null }`. These are the same safe fields the public page shows. Internal routing, roles and vouchers are never returned.

What happens next, in this order:
1. **Duplicate check (R0).** If the same text arrived in the last 24 hours, the same reviewer posted in the last 30 minutes, or 5 or more reviews arrived in 5 minutes, the case is flagged as a possible duplicate and sent to at least a Manager, with no voucher offered.
2. **Classify and draft.** The AI model reads the text (BM, English or Manglish) and returns a category, sentiment, severity and a draft reply. If the model is slow, fails or returns invalid JSON, keyword rules take over ("Basic mode").
3. **Route (R1 to R6).** Plain rules choose the role. High severity (safety, harassment, money disputes) always goes to the Owner.
4. **Log.** `review_received`, `rule_routed` (and `flagged_duplicate` when relevant) are written to the append-only activity log.

**Assumption:** Orbyte can call an HTTPS webhook when a review arrives, or forward one from its own channels. A production version would add a per-tenant signing secret (HMAC header) to this endpoint.

## 2. One way out: the reply-posted event

Nothing leaves Resolve until a person with the right role approves it. On approval Resolve writes `approved` and `reply_posted` to the activity log, and the reply appears on the public review page.

In production, the `reply_posted` step is the only part that changes. It would call the channel's own API:

| Channel | Real API call | What we need from Orbyte or the business |
| --- | --- | --- |
| Google Business Profile | `PUT accounts/{accountId}/locations/{locationId}/reviews/{reviewId}/reply` (Business Profile API, `updateReply`) | Business Profile API access (Google approval), the owner's OAuth consent, and the location's Place ID |
| WhatsApp follow-up | WhatsApp Business Platform, approved message template | Guest opt-in and an approved template |
| Orbyte | An event such as `resolve.reply_posted { caseId, outletId, reply, approvedBy, approvedAt }` | An endpoint or event bus Orbyte listens on |

**Assumption:** Orbyte keeps the official channel connections, and Resolve sends one `reply_posted` event after human approval.

## 3. Identity and roles

- The demo has its own login (salted scrypt passwords, signed 12-hour session tokens) with three roles: **Staff, Manager, Owner**.
- **Assumption:** in Orbyte, the login would be Orbyte's single sign-on. Resolve only needs `userId`, `tenantId`, `outletId` and `role` from it. Every permission check (`authorize()`) already runs on the server, inside the same database transaction as the action.

## 4. Tenant settings are data

A business is a row of settings, not code: name, business type, outlets, team, and the Manager voucher limit (default RM 20). The five business types (café, hair salon, retail shop, car workshop, pet care) share one set of categories and one set of routing rules; only the words, sample reviews and reply templates change. A new SME type is one new profile.

**Assumption:** Orbyte already stores tenants and outlets, so Resolve could read them instead of keeping its own copies.

## 5. Google Place ID

Each tenant has an optional `google_place_id` column. In the demo it is empty, and the simulated review page (`/p/:outletId`) stands in for the Google listing. With a real Place ID, the outlet's QR code could point to the Google "write a review" link instead, and replies would go out through the Business Profile API above.

## 6. What is simulated in the demo

| Part | In the demo | In production |
| --- | --- | --- |
| Review source | Simulated public page and "Bring in a review" | Google Business Profile, WhatsApp, Orbyte |
| Posting replies | Shown on the simulated page | Business Profile API `updateReply` |
| WhatsApp follow-up | Logged, not sent | WhatsApp Business Platform |
| Login | Resolve's own accounts with synthetic `.demo` emails | Orbyte single sign-on |
| Payments | None | Not needed for this workflow |
| Data | Synthetic reviews, names and vouchers | Real, with PDPA consent |
