# DayKeeper (G1)

AI-powered life management system for people in vulnerable groups: upload a photo of a document, the system reads it, and it becomes tasks and reminders. RMIT COSC2648 capstone project, P000473SE, Group 1.

## What is here

- `docs/project-description.md`: the official project description, verbatim. Our requirements baseline.
- `docs/DayKeeper-Tech-Stack-Recommendation.md`: Sai's technology stack proposal
- `docs/Technical-Research-and-Implementation-Roadmap.md`: step-by-step research and build plan.
- `docs/prototype/user/daykeeper-sketch-live.html`: clickable prototype of the user flow (open in a browser). The admin side is not designed yet; its prototype will come as a separate file.
- `src/`: Next.js app (App Router, TypeScript, Tailwind, shadcn/ui). See below to run it.

## Running the app

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

Copy `.env.example` to `.env.local` and fill in Supabase credentials before wiring up auth/storage. The AI/OCR provider defaults to a mock adapter until a real provider is confirmed.

## Team

Gerry Lu (Scrum Master) · Xiaocong "XC" Su · Hiruni Perera · Zhenying "Sai" Cui · Junchun "Jason" Zhang
Client: Prof. Mohammad Patwary · Supervisor: Dr. Golnoush Abaei
