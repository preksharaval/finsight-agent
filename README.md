# FinSight — Autonomous Financial Monitoring Agent

An AI agent that ingests company transactions and autonomously computes runway, P&L,
and burn; flags expense categories outpacing revenue; and generates prioritized
recommendations. Built as a portfolio project to explore the AI-FinOps problem space.

**Stack:** React + Vite + Recharts · Google Gemini (via secure serverless function) · deploys free on Vercel

---

## Deploy your own live version (~15 minutes, free — no credit card)

You'll need: a free [GitHub](https://github.com) account, a free [Vercel](https://vercel.com)
account, and a free [Google AI Studio](https://aistudio.google.com) API key.

### Step 1 — Get a free Gemini API key
1. Go to https://aistudio.google.com → **Get API key** → **Create API key**.
2. Copy the key. No credit card required — the free tier covers far more than a demo needs.
   Keep it private: you'll paste it into Vercel, never into the code.

### Step 2 — Put this project on GitHub
1. Create a new repo at https://github.com/new → name it `finsight-agent` → **Create**.
2. On the new repo page click **"uploading an existing file"**, then drag in everything
   from this folder **except** `node_modules` and `dist`.
   (Or with git: `git init && git add . && git commit -m "init" && git push`.)

### Step 3 — Import into Vercel
1. Go to https://vercel.com → **Add New… → Project**.
2. **Import** your `finsight-agent` GitHub repo.
3. Vercel auto-detects Vite — leave build settings as-is.
4. **Before clicking Deploy**, expand **Environment Variables** and add:
   - **Name:** `GEMINI_API_KEY`   (exactly this — case-sensitive)
   - **Value:** your Gemini key from Step 1
5. Click **Deploy**. Wait ~60 seconds.

### Step 4 — Test it
Vercel gives you a public URL like `https://finsight-agent-yourname.vercel.app`.
**Open it and confirm the agent generates a verdict before sharing the link anywhere.**
The agent auto-runs on load; "Re-run agent" works for any visitor.

---

## How it works
- **`src/FinSightAgent.jsx`** — the dashboard. Computes metrics (runway, burn, P&L, anomalies)
  in the browser, then sends a structured brief to the agent for analysis.
- **`api/analyze.js`** — a Vercel serverless function that holds your Gemini key *server-side*
  and forwards the request to Google. Your key is never exposed to the browser.

## Security note
The API key lives only in Vercel's encrypted environment variables, used server-side.
It is never bundled into the frontend, so visitors cannot see or steal it.

---
*Built by Preksha Raval · mock seed-stage SaaS financials · for portfolio demonstration.*
