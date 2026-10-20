# Project Name : Resolve

> A product that helps SME's owners to better cater their reviews by assistance from AI by automated reviews with the supervision of managers and owners to oversee the reviews automated by AI and approve it.

---

## Team Information

| Field                  | Details                                     |
| ---------------------- | ------------------------------------------- |
| **Team Name**          | sticks and stones           |
| **Team Domain**        | Domain 2        |
| **SDG Track (1–17)**   | SDG 8 — DECENT WORK AND ECONOMIC GROWTH |
| **Team Leader**        | Ee Jun Hao                             |
| **University**         | Xiamen Univeristy Malaysia                    |
| **Number of Members**  | 2                                  |

## Links

| Resource          | Link                                           |
| ----------------- | ---------------------------------------------- |
| GitHub Repository | https://github.com/ejhchesteree7-code/Resolve-SDC-HACKATHON-  |
| Replit Project    | https://replit.com/@your-username/your-project |
| Live Demo         | https://your-project.replit.app                |
| RunPod Endpoint   | https://api.runpod.ai/v2/your-endpoint-id      |
| Slide Deck        | https://example.com/slides                     |
| Demo Video        | https://example.com/demo-video                 |

---

## Overview

### Problem

Malaysian café and retail owners reply to customer reviews and complaints late, inconsistently, or not at all, because they are scattered across Google, WhatsApp and staff memory. Nobody is sure who is allowed to offer compensation, and recurring issues such as slow Friday-night service go unnoticed because nothing is tracked.

### Solution

Resolve turns every review into a tracked case: AI reads the text in BM, English or Manglish, classifies it and drafts a reply with a one-line reason, while plain rules route it to the right role. Nothing is posted or compensated until a staff member, manager or owner approves it, and every step is saved in an activity log that also surfaces recurring issues for the owner.

### Key Features

- 1. AI triage and draft: classifies sentiment, category and severity, and drafts a reply in the review’s language.
- 2. Role-based approval: staff, manager and owner approve different actions, with compensation limits.
- 3. Activity log and recurring-issue alerts: every action is recorded, and repeated complaints are flagged.

### Tech Stack

| Layer         | Technology                   |
| ------------- | ---------------------------- |
| Frontend      | React + Vite + Tailwind CSS  |
| Backend       | Supabase (edge functions / server route for AI calls) |
| Database      | Supabase Postgres            |
| AI / Compute  | Claude API for classification and reply drafting; RunPod (GPU)            |
| Hosting / Dev | Replit (build and run), plus Vercel or Replit deployment for the demo link            |

---

## Project Structure

```
.
├── docs/                    # Screenshots, diagrams
├── runpod/
│   └── handler.py           # RunPod serverless handler (GPU workload)
├── src/
│   ├── main.py              # Application entry point
│   └── utils.py             # Helper functions
├── submission/              # Required submission documents
│   ├── REPLIT PROOF OF USE.pdf
│   ├── RUNPOD PROOF OF USE.pdf
│   └── Submission Template SDC Hackathon.pdf
├── tests/
│   └── test_utils.py        # Unit tests
├── .env.example             # Example environment variables
├── .gitignore
├── .replit                  # Replit run configuration
├── LICENSE
├── requirements.txt         # Python dependencies
└── README.md
```

### Architecture

```
User ──► Replit (App / API) ──► RunPod Endpoint (GPU model)
                │
                └──► Response returned to user
```

---

## How to Run

### Option 1 — Run on Replit (Recommended)

1. Open the [Replit Project](https://replit.com/@your-username/your-project), or import this repository via **Create Repl → Import from GitHub**.
2. Open the **Secrets** tab (🔒) and add the variables listed in `.env.example`:
   - `RUNPOD_API_KEY`
   - `RUNPOD_ENDPOINT_ID`
3. Click **Run**. Replit uses the `.replit` file to start `python src/main.py`.

### Option 2 — Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/your-username/your-project.git
cd your-project

# 2. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment variables
cp .env.example .env            # then fill in your values

# 5. Run the app
python src/main.py
```

### Run Tests

```bash
python -m unittest discover tests
```

---

## How We Use Replit *(Required)*

Describe how your team used Replit. For example:

- **Development:** Collaborative coding in a shared Repl using Multiplayer.
- **Hosting:** The app is deployed with Replit Deployments at the Live Demo link above.
- **Secrets:** API keys are stored in Replit Secrets, never in the code.

📄 Proof of use: [`submission/REPLIT PROOF OF USE.pdf`](submission/REPLIT%20PROOF%20OF%20USE.pdf)

## How We Use RunPod *(Required)*

Describe how your team used RunPod. For example:

- **Workload:** Model inference (e.g. text generation, image processing) runs on a RunPod GPU.
- **Setup:** `runpod/handler.py` is deployed as a **RunPod Serverless Endpoint**.
- **Integration:** The Replit app sends requests to the endpoint using `RUNPOD_API_KEY` and `RUNPOD_ENDPOINT_ID`.

Example request:

```bash
curl -X POST https://api.runpod.ai/v2/$RUNPOD_ENDPOINT_ID/runsync \
  -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": {"prompt": "Hello"}}'
```

📄 Proof of use: [`submission/RUNPOD PROOF OF USE.pdf`](submission/RUNPOD%20PROOF%20OF%20USE.pdf)

---

## Challenges & Learnings

- What challenges did you face, and how did you overcome them?
- What did your team learn?

## Future Improvements

- [ ] Improvement 1
- [ ] Improvement 2

## Team

| Name        | Role                | GitHub                                   |
| ----------- | ------------------- | ---------------------------------------- |
| Member Name | Team Lead / Backend | [@username](https://github.com/username) |
| Member Name | Frontend            | [@username](https://github.com/username) |
| Member Name | AI / RunPod         | [@username](https://github.com/username) |

---

## Submission Checklist

- [ ] Team name, domain (Domain 1 / Domain 2) and SDG track filled in
- [ ] Slide deck link added
- [ ] Demo video link added
- [ ] Replit used, with proof of use in `submission/`
- [ ] RunPod used, with proof of use in `submission/`
- [ ] Submission template completed in `submission/`
- [ ] "How to Run" steps verified
- [ ] No API keys or secrets committed to the repository

## License

This project is licensed under the [Apache License 2.0](LICENSE).
