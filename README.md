# Project Name : Resolve

> A review-to-resolution workflow for Malaysian café and retail owners. AI drafts and classifies, plain rules route, and a human with the right role approves.

---

## Team Information

| Field | Details |
| --- | --- |
| **Team Name** | sticks and stones |
| **Team Domain** | Domain 2 |
| **SDG Track (1–17)** | SDG 8: Decent Work and Economic Growth |
| **Team Leader** | Ee Jun Hao |
| **University** | Xiamen University Malaysia |
| **Number of Members** | 2 |

## Links

| Resource | Link |
| --- | --- |
| GitHub Repository | https://github.com/ejhchesteree7-code/Resolve-SDC-HACKATHON- |
| Replit Project | [https://resolve-cafe-review-workflow.replit.app] |
| Live Demo (Vercel) | https://resolve-sdc-hackathon-src.vercel.app |
| Customer review page (simulated) | https://resolve-sdc-hackathon-src.vercel.app/p/bangsar |
| Slide Deck | [add link] |
| Demo Video | [add link] |

---

## Overview

### Problem
Malaysian café and retail owners reply to customer reviews late, inconsistently, or not at all, because reviews are scattered across Google, WhatsApp and staff memory. Nobody is sure who may offer compensation, and recurring issues such as slow Friday-night service go unnoticed.

### Solution
Resolve turns every review into a tracked case. It classifies the text (BM, English or Manglish), drafts a reply with a one-line reason, and routes the case to the right role with plain rules. Nothing is posted or compensated until a person with the right role approves it. Every step is stored in an append-only activity log, and recurring issues are surfaced to the owner.

**Design principle:** it is a governed workflow with AI inside one step, not a chatbot. Routing, permissions and voucher limits are plain, explainable rules.

### Key Features
1. **AI triage and draft** with strict JSON validation, an 8-second timeout, and a keyword fallback ("Basic mode") so the journey never depends on AI being available.
2. **Rule-based routing (R1 to R6)** and voucher limits: a Manager can approve up to RM 20, and anything above escalates to the Owner.
3. **Role-gated approval enforced on the server** (Staff, Manager, Owner). Unauthorised actions return 403 and change nothing.
4. **Append-only audit log** enforced by a database trigger (updates and deletes are rejected).
5. **Recurring-issue insight** (for example "Slow service on Friday nights, 6 reviews").
6. **Simulated public review page** (`/p/:outletId`) standing in for the Google Business Profile. Reviews flow in, and approved replies appear back on the page within seconds. An NFC card or QR code opens this page.

### Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node / Express API, deployed as a Vercel serverless function |
| Database | Supabase Postgres (RLS on with no public policies; the server connects through a pooled connection string) |
| AI | OpenAI-compatible model for classification and drafting (optional), with a built-in keyword fallback |
| Build | Replit (development with Replit Agent) |
| Hosting | Vercel |

---

## What Is Simulated (Honest Limits)
- **Identity:** a "Viewing as" role switcher replaces a real login. Enforcement is real (server-side checks), the identity is not.
- **Google Business Profile:** the real API needs Google approval, so a simulated public review page stands in for it.
- **WhatsApp:** not built. Roadmap only.
- **Data:** all reviews, names and vouchers are synthetic. Time-saved figures are estimates from our own timed tests.
- **AI:** seeded reviews use cached drafts. To avoid API cost, the deployed demo runs new reviews in Basic mode (keyword rules and templates) unless an AI key is configured.

## Orbyte Fit and Reuse
Tenant settings (outlets, roles, voucher limit, categories) are data, so a salon, clinic or retail shop can reuse the same workflow by changing settings only. Reviews enter through one event (`POST /events/review-received`), so any channel (NFC, QR, Google Business Profile, WhatsApp) can plug in.

## Privacy (PDPA)
Only an alias and the review text are collected. Access is limited by role, every action is logged, no customer data is used for model training, and no reply is sent without human approval. Vouchers are service recovery and are never tied to posting, editing or removing a public review.

---

## How to Run

```bash
git clone https://github.com/ejhchesteree7-code/Resolve-SDC-HACKATHON-.git
cd Resolve-SDC-HACKATHON-/src
cp .env.example .env     # fill in DATABASE_URL (and optionally AI_API_KEY)
pnpm install
pnpm run build:vercel
```

**Database:** on an empty Postgres (for example a Supabase project), run `src/lib/db/schema.sql` and then `src/lib/db/seed.sql`, once each.

**Environment variables** (see `.env.example`): `DATABASE_URL`, `AI_API_KEY` (optional), `AI_MODEL`, `AI_DISABLED`. Never commit real values.

**Live demo:** open the Live Demo link, switch "Viewing as" to Owner, and use "Demo links" to open the customer review page.

---

## How We Use Replit *(Required)*
- **Development:** the whole app was built with Replit Agent: the React frontend, the Express API, the database schema, the automated tests and the security hardening.
- **Secrets:** API keys were kept in Replit Secrets, never in code.
- **Deployment:** the final demo is hosted on Vercel with Supabase. The Replit deployment remains as a backup.

📄 Proof of use: [`submission/REPLIT PROOF OF USE.pdf`](submission/REPLIT%20PROOF%20OF%20USE.pdf)

## How We Use RunPod
RunPod was not used. It is optional for this challenge. Resolve's AI step is a single short classification and drafting call, and plain rules plus a fallback handle the rest, so GPU hosting would add cost and a new point of failure without improving the demo.

---

## Challenges & Learnings
- **Live AI failed at first:** the model echoed the list of allowed values instead of choosing one. We kept the strict validation, fixed the prompt, and added a keyword fallback so the demo never depends on AI.
- **Moving from Replit to Vercel and Supabase:** Vercel type-checked the API and failed, so we pre-bundled the API with esbuild. Replit's built-in AI proxy does not exist outside Replit.
- **Database migration conflicts** when publishing on Replit, solved by creating new tables and rebuilding from a portable `schema.sql` and `seed.sql`.
- **Google Business Profile API access takes weeks**, so we built a simulated review page to show the full loop.
- **Learning:** keep AI to the text-understanding step and use rules for everything that must be predictable and auditable.

## Future Improvements
- [ ] Real authentication (Orbyte login) instead of the role switcher
- [ ] Google Business Profile connector and WhatsApp follow-ups with consent
- [ ] Private voucher delivery to the customer
- [ ] Shift-log cross-referencing to explain recurring issues

## Team

| Name | Role | GitHub |
| --- | --- | --- |
| Ee Jun Hao | Team Lead / Tech | [@ejhchesteree7-code](https://github.com/ejhchesteree7-code) |
| [Adeetheyaa Ram A/L Sailesh Kumar] | Pitch deck, video and testing | [@username](https://github.com/username) |

---

## Submission Checklist

- [x] Team name, domain and SDG track filled in
- [ ] Slide deck link added
- [ ] Demo video link added
- [x] Replit used, with proof of use in `submission/`
- [x] Submission template completed in `submission/`
- [x] "How to Run" steps written
- [x] No API keys or secrets committed to the repository

## License

This project is licensed under the [Apache License 2.0](LICENSE).