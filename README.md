# Project Name : Resolve

> A review-to-resolution workflow for owner-run Malaysian SMEs (cafés, salons, retail shops, car workshops and pet care). AI drafts and classifies, plain rules route, and a human with the right role approves.

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
| Register a new business (simulated) | https://resolve-sdc-hackathon-src.vercel.app/register |
| Interface assumptions (Orbyte, Google, WhatsApp) | [docs/interface-assumptions.md](docs/interface-assumptions.md) |
| **Grand Final Report (PDF)** | [submission/1. SDC Hackathon_ Submission Template (Finalists) FINALIST.pdf](submission/1.%20SDC%20Hackathon_%20Submission%20Template%20%28Finalists%29%20FINALIST.pdf) |
| **Grand Final Technical Tools Declaration (PDF)** | [submission/2. SDC Hackathon_ Tech. Tools Declaration Template  FINALIST (Finalist).pdf](submission/2.%20SDC%20Hackathon_%20Tech.%20Tools%20Declaration%20Template%20%20FINALIST%20%28Finalist%29.pdf) |
| Preliminary Project Proposal (PDF) | [submission/SDC2026_sticksandstones_Preliminary.pdf](submission/SDC2026_sticksandstones_Preliminary.pdf) |
| Technical Tools Declaration, Round 1 (PDF) | [submission/SDC2026_sticksandstones_TechDeclaration.pdf](submission/SDC2026_sticksandstones_TechDeclaration.pdf) |
| Slide Deck, Round 1 | [submission/SDC_sticksandstones_slidedeck.pdf](submission/SDC_sticksandstones_slidedeck.pdf) |
| Demo Video, Round 1 | [https://youtu.be/30II16Fx6RE](https://youtu.be/30II16Fx6RE) |

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
8. **Login and team access:** every person has their own login (Staff, Manager or Owner). The Owner's Team page adds people, resets passwords and removes access the day someone leaves; everyone can change their own password under My account.
9. **Register a business in one page:** pick a business type, name the outlet, add the team, and get a printable QR code for the outlet's review page plus one-time passwords for each person.
10. **Five SME types on one workflow:** café, hair salon, retail shop, car workshop and pet care (shop, grooming, boarding). Each type has its own words, sample reviews and reply templates; the routing rules and safety escalation are the same for all.
11. **Duplicate and spam check (R0):** identical text within 24 hours, the same reviewer within 30 minutes, or a burst of 5 reviews in 5 minutes is flagged, sent to at least a Manager, and never offered a voucher.
12. **Overdue alerts:** urgent cases are overdue after 2 hours and others after 24 hours. Overdue cases are badged, counted and sorted to the top.
13. **Impact page:** measures handling time from real approvals against our manual baseline, approval coverage from the log, and routing accuracy on a labelled test set.
14. **Improvement checklist:** Resolve counts repeated complaints from the last 30 days, the AI words one concrete fix for each (rules if the AI is off), and the Owner accepts, edits or dismisses it. Once a fix is marked done, Resolve compares complaints per week for that category before and after, so the owner sees whether it worked. The counts always come from the database, never from the AI.

### Results
**Grand Final (measured inside the app):** each approval is timed from opening a case to clicking Approve and written into the activity log. Median handling time **12.5 s per review, 82.8% faster** than the 72.5 s manual baseline (target: at least 60%), with **100%** of replies and vouchers carrying a logged human approval. These figures are shown live on the Impact page and change as more cases are handled.

**Phase 1 (our own timed test):** we timed how long it takes to handle 10 synthetic reviews (a mix of complaints and compliments).

| Method | Total for 10 reviews | Per review |
| --- | --- | --- |
| Manual replies (Bangsar) | 12.08 min | 72.5 s |
| Resolve, Basic mode: draft plus human approval (Mont Kiara) | 4.5 min | 27 s |

That is 62.7% less handling time. This is a small test, not a controlled study: one run of 10 reviews per method, on two simulated outlets, with synthetic data and the live demo in Basic mode (keyword rules and templates, no AI key).

**Routing test set:** 55 labelled synthetic reviews across all five business types (written and labelled by the team before checking Resolve's output). Basic mode routes **55 of 55 (100%)** to the right role and gets the category right on **54 of 55 (98.2%)**. The Impact page reruns this set live.

### Security
The live site sets security headers (CSP, HSTS and others) and scored 125/100 (A+) on the MDN HTTP Observatory scan. Authorization is enforced on the server for every action, and secrets are kept in environment variables, never in the repository.

### Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node / Express API, deployed as a Vercel serverless function |
| Database | Supabase Postgres (RLS on with no public policies; the server connects through a pooled connection string) |
| AI | gpt-5.4-mini through the KrackedDevs OpenAI-compatible API (sponsor credits) for classification, drafting and improvement suggestions, with a built-in keyword fallback (Basic mode) |
| Build | Replit Agent (first version); Claude Code (later improvements) |
| Hosting | Vercel |

---

## What Is Simulated (Honest Limits)
- **Identity:** Resolve has its own login with synthetic `.demo` email accounts and no email verification. In Orbyte this would be Orbyte's single sign-on. Permission checks run on the server either way.
- **Business registration:** sign-up is instant and needs no payment. The QR code opens the simulated review page.
- **Google Business Profile:** the real API needs Google approval, so a simulated public review page stands in for it.
- **WhatsApp:** the private follow-up is simulated (no message leaves the app, and voucher codes are demo codes). A real version would use the WhatsApp Business Platform with approved message templates and guest opt-in, and would replace only the send step.
- **Data:** all reviews, names and vouchers are synthetic. Time-saved figures are estimates from our own 10-review timed test (see Results).
- **AI:** the live demo uses gpt-5.4-mini for new reviews. The 20 seeded demo reviews are pre-classified (labelled "no live AI call"). If the AI is unavailable, a case shows a "Basic mode" badge and still reaches the right person.

## Orbyte Fit and Reuse
Tenant settings (business type, outlets, team, voucher limit) are data, so the same workflow already runs for a café, a hair salon, a retail shop, a car workshop and a pet care business. Adding another SME type is one new profile of words and templates, not new code paths. Reviews enter through one event (`POST /api/events/review-received`) and leave through one (`reply_posted`) after human approval, so any channel (NFC, QR, Google Business Profile, WhatsApp) can plug in. Details: [docs/interface-assumptions.md](docs/interface-assumptions.md).

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

**Database:** on an empty Postgres (for example a Supabase project), run `src/lib/db/schema.sql` and then `src/lib/db/seed.sql`, then the files in `src/lib/db/migrations/` in number order (`0001` to `0007`). Each migration is safe to run twice. To give the Brew & Kin demo a fresh, dated-today inbox (for example on demo day), run `src/lib/db/demo-reset.sql`; it only touches the synthetic demo business.

**Environment variables** (see `src/.env.example`): `DATABASE_URL`, `SESSION_SECRET` (recommended), `AI_API_KEY`, `AI_BASE_URL` and `AI_MODEL` (optional, any OpenAI-compatible provider), `AI_DISABLED`. Never commit real values.

**Tests:** `pnpm --filter @workspace/api-server run test` (needs a local Postgres in `DATABASE_URL`).

**Live demo:** open the Live Demo link and log in with a demo account (all synthetic, password `resolve-demo`):

| Role | Email | Can do |
| --- | --- | --- |
| Owner | owner@brewkin.demo | Everything, including urgent cases, vouchers above the limit, Team page |
| Manager | manager@brewkin.demo | Approve replies and vouchers up to RM 20, send follow-ups |
| Staff | staff@brewkin.demo | Approve praise and simple, low-severity replies only; no vouchers, no activity log |

Or open **Register a business** on the login page to create a new one (for example a salon or pet care business) with its own QR code.

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
- [ ] Orbyte single sign-on instead of Resolve's own demo login
- [ ] Google Business Profile connector and real WhatsApp delivery with guest opt-in
- [ ] Single-use voucher codes stored and validated at redemption
- [ ] Shift-log cross-referencing to explain recurring issues

## Team

| Name | Role | GitHub |
| --- | --- | --- |
| Ee Jun Hao | Team Lead / Tech | [@ejhchesteree7-code](https://github.com/ejhchesteree7-code) |
| [Adeetheyaa Ram A/L Sailesh Kumar] | Pitch deck, video and testing | [@adeetheya397-afk](https://github.com/adeetheya397-afk) |

---

## Submission Checklist

- [x] Team name, domain and SDG track filled in
- [x] Preliminary Proposal and Technical Tools Declaration final PDFs uploaded to `submission/`
- [x] Slide deck link added
- [x] Demo video link added
- [x] Replit used, with proof of use in `submission/`
- [x] Submission template completed in `submission/`
- [x] "How to Run" steps written
- [x] No API keys or secrets committed to the repository

## License

This project is licensed under the [Apache License 2.0](LICENSE).