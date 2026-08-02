# AGENTS.md

DayKeeper (Group 1): an AI-powered life management system for people in vulnerable groups. A user uploads a photo of a letter or document, the system reads it, and it becomes tasks and reminders. RMIT COSC2648 capstone project, P000473SE.

## Where things live

- `docs/project-description.md`: the official project description, verbatim. Our requirements baseline; when wording conflicts, this file wins.
- `docs/DayKeeper-Tech-Stack-Recommendation.md`: the tech stack recommendation (draft until the team adopts it).
- `docs/prototype/user/daykeeper-sketch-live.html`: clickable prototype of the user flow. The admin prototype will come as a separate file.
- `docs/ai-prompts/`: AI usage records for the course GenAI declaration (create on first use). If AI helped with a change, log it there.

## Conventions

- Everything in this repository is written in English.
- Say "photo upload", not "scan": the input is a phone photo of a document, per the project description's responsive web app framing.
- Commit messages in English, imperative mood. Do not add AI attribution or Co-Authored-By lines to commits.
- Never commit secrets, API keys, or `.env` files. Personal API keys and personal paid cloud accounts are banned for this project.
- Large binaries and generated output stay out of git (see `.gitignore`); small curated fixtures are fine.

## Build and test

No application code yet. When the scaffold lands, this section gets the real commands (install, dev server, lint, test); keep it current with the code.
