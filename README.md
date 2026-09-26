# SmartPlaze

Multi-vendor e-commerce marketplace — internal product of GODWIN TECH SOLUTION.
See [`docs/Cahier_de_Charges_Smart_Market.docx`](docs/Cahier_de_Charges_Smart_Market.docx) for the full functional/technical scope.

Two independent projects, run separately:

- [`frontend/`](frontend) — Next.js (TypeScript, App Router) + Tailwind CSS + Motion
- [`backend/`](backend) — Express.js (JavaScript) + PostgreSQL via Prisma 7, MVC architecture

## Local development

PostgreSQL runs locally on this machine (Windows service `postgresql-x64-18`). Before starting the
backend, create the database once and point `backend/.env` at it:

```bash
createdb smart_market
```

Then, in two terminals:

```bash
cd backend && npm install && npm run dev     # http://localhost:5000
cd frontend && npm install && npm run dev    # http://localhost:3000
```

Each project has its own `README.md`, `package.json` and `.env.example` — they are not meant to
share dependencies or be run from a shared root.
