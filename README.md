# Project Name : Resolve

> A review-to-resolution workflow for owner-run Malaysian cafés. AI drafts and classifies, plain rules route, and a human with the right role approves.

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
| Replit Project | https://resolve-cafe-review-workflow.replit.app |
| Live Demo (Vercel) | https://resolve-sdc-hackathon-src.vercel.app |
| Customer review page, Bangsar (simulated) | https://resolve-sdc-hackathon-src.vercel.app/p/bangsar |
| Customer review page, Mont Kiara (simulated) | https://resolve-sdc-hackathon-src.vercel.app/p/mont-kiara |
| Preliminary Project Proposal (PDF) | [submission/SDC2026_sticksandstones_Preliminary.pdf](submission/SDC2026_sticksandstones_Preliminary.pdf) |
| Technical Tools Declaration (PDF) | [submission/SDC2026_sticksandstones_TechDeclaration.pdf](submission/SDC2026_sticksandstones_TechDeclaration.pdf) |
| Slide Deck | [https://github.com/ejhchesteree7-code/Resolve-SDC-HACKATHON-/blob/main/submission/SDC_sticksandstones_slidedeck.pdf] |
| Demo Video | [add link] |

---

## Overview

### Problem
Owners of Malaysian cafés reply to customer reviews late, inconsistently, or not at all, because reviews are scattered across Google, WhatsApp and staff memory. Nobody is sure who may offer compensation, and recurring issues such as slow Friday-night service go unnoticed.

### Solution
Resolve turns every review into a tracked case. It classifies the text (BM, English or Manglish), drafts a reply with a one-line reason, and routes the case to the right role with plain rules. Nothing is posted or compensated until a person with the right role approves it. Every step is stored in an append-only activity log, and recurring issues are surfaced to the owner.

**Design principle:** it is a governed workflow with AI inside one step, not a chatbot. Routing, permissions and voucher limits are plain, explainable rules.

### Key Features
1. **AI triage and draft** with strict JSON validation, a 12-second timeout, and a keyword fallback ("Basic mode") so the journey never depends on AI being available.
2. **Rule-based routing (R1 to R6)** and voucher limits: a Manager can approve up to RM 20, and anything above escalates to the Owner. High-severity cases (for example food safety) always go to the Owner, including in Basic mode.
3. **Role-gated approval enforced on the server** (Staff, Manager, Owner). Unauthorised actions return 403 and change nothing.
4. **Append-only audit log** enforced by a database trigger (updates and deletes are rejected).
5. **Recurring-issue insight** (for example "Slow service on Friday nights, 6 reviews").
6. **Simulated public review page** (`/p/:outletId`) standing in for the Google Business Profile. Reviews flow in, and approved replies appear back on the page within seconds. An NFC card or QR code opens this page.
7. **Private guest follow-up (simulated WhatsApp):** once a case is resolved, a Manager or Owner can send the guest a private message, with an optional goodwill voucher and code that never appear in the public reply. The send is written to the audit log. Staff cannot send, and nothing is sent before a human approves.

### Results So Far (Our Own Timed Test)
We timed how long it takes to handle 10 synthetic reviews (a mix of complaints and compliments).

| Method | Total for 10 reviews | Per review |
| --- | --- | --- |
| Manual replies (Bangsar) | 12.08 min | 72.5 s |
| Resolve, Basic mode: draft plus human approval (Mont Kiara) | 4.5 min | 27 s |

That is 62.7% less handling time. This is a small test, not a controlled study: one run of 10 reviews per method, on two simulated outlets, with synthetic data and the live demo in Basic mode (keyword rules and templates, no AI key).

### Security
The live site sets security headers (CSP, HSTS and others) and scored 125/100 (A+) on the MDN HTTP Observatory scan. Authorization is enforced on the server for every action, and secrets are kept in environment variables, never in the repository.

### Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node / Express API, deployed as a Vercel serverless function |
| Database | Supabase Postgres (RLS on with no public policies; the server connects through a pooled connection string) |
| AI | OpenAI-compatible model for classification and drafting (optional), with a built-in keyword fallback |
| Build | Replit Agent (first version); Claude Code (later improvements) |
| Hosting | Vercel |

---

## What Is Simulated (Honest Limits)
- **Identity:** a "Viewing as" role switcher replaces a real login. Enforcement is real (server-side checks), the identity is not.
- **Google Business Profile:** the real API needs Google approval, so a simulated public review page stands in for it.
- **WhatsApp:** the private follow-up is simulated (no message leaves the app, and voucher codes are demo codes). A real version would use the WhatsApp Business Platform with approved message templates and guest opt-in, and would replace only the send step.
- **Data:** all reviews, names and vouchers are synthetic. Time-saved figures are estimates from our own 10-review timed test (see Results).
- **AI:** seeded reviews use cached drafts. To avoid API cost, the deployed demo runs new reviews in Basic mode (keyword rules and templates) unless an AI key is configured.

## Orbyte Fit and Reuse
Tenant settings (outlets, roles, voucher limit, categories) are data, so a salon, clinic or retail shop can reuse the same workflow by changing settings only. Reviews enter through one event (`POST /events/review-received`), so any channel (NFC, QR, Google Business Profile, WhatsApp) can plug in.

## Privacy (PDPA)
Only a first name or alias, the rating and the review text are collected. Access is limited by role, every action is logged, no customer data is used for model training, and no reply is sent without human approval. Vouchers are service recovery and are never tied to posting, editing or removing a public review.

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
- **Development:** Replit Agent built the first version of the app: the React frontend, the Express API, the database schema and the first tests. Later improvements (AI triage and routing, recurring-issue insight, security headers, the simulated WhatsApp follow-up, deployment and documentation) were made with Claude Code. Both are declared in the Technical Tools Declaration.
- **Secrets:** API keys were kept in Replit Secrets, never in code.
- **Deployment:** the final demo is hosted on Vercel with Supabase. The Replit deployment remains as a backup.

📄 Proof of use: [`submission/PROOF OF USING REPLIT SDC.pdf`](submission/PROOF%20OF%20USING%20REPLIT%20SDC.pdf)

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
- [ ] Google Business Profile connector and real WhatsApp delivery with guest opt-in
- [ ] Single-use voucher codes stored and validated at redemption
- [ ] Shift-log cross-referencing to explain recurring issues

## Team

| Name | Role | GitHub |
| --- | --- | --- |
| Ee Jun Hao | Team Lead / Tech | [@ejhchesteree7-code](https://github.com/ejhchesteree7-code) |
| [Adeetheyaa Ram A/L Sailesh Kumar] | Pitch deck, video and testing | [@username](https://github.com/username) |

---

## Submission Checklist

- [x] Team name, domain and SDG track filled in
- [ ] Preliminary Proposal and Technical Tools Declaration final PDFs uploaded to `submission/`
- [ ] Slide deck link added
- [ ] Demo video link added
- [x] Replit used, with proof of use in `submission/`
- [x] Submission template completed in `submission/`
- [x] "How to Run" steps written
- [x] No API keys or secrets committed to the repository

## License

This project is licensed under the [Apache License 2.0](LICENSE).