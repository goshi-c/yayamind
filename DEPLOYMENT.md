# YayaMind Deployment Notes

## Current Goal

YayaMind needs two deployment modes:

- Portfolio preview: interviewers can open a public URL and understand the product.
- Real personal use: the user can open a web URL and write persistent personal data.

The current codebase is local-first. The React/Vite frontend calls `/api/*`, and the Fastify backend writes to `personal-assistant-data/`. That local data directory is intentionally ignored by Git.

## What Can Be Deployed Now

The app can be deployed to Vercel as a portfolio preview.

Behavior:

- When the local backend is available, the app uses real local data.
- When `/api/bootstrap` is unavailable, the app falls back to a read-only portfolio preview dataset.
- The preview is enough for an interviewer to click around and understand the product shape.
- The preview is not a replacement for real cloud storage.

Vercel settings:

```text
Framework Preset: Vite
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

## GitHub Setup

Create an empty GitHub repository, then connect this local project:

```powershell
git init
git add .
git commit -m "Initial YayaMind MVP"
git branch -M main
git remote add origin https://github.com/<your-name>/<repo-name>.git
git push -u origin main
```

Do not commit:

- `.env`
- `.env.local`
- `personal-assistant-data/`
- `node_modules/`
- `dist/`

These are already covered by `.gitignore`.

## Real Personal Use

Opening a Vercel frontend alone is not enough for real use, because Vercel's static frontend cannot write to `personal-assistant-data/` on the user's computer.

To make YayaMind usable from any browser as a real product, the local backend/data layer should be migrated to:

```text
Vercel frontend
+ hosted API
+ cloud database
+ user login
+ per-user data isolation
+ AI key / usage control
```

Recommended next architecture:

- Frontend: keep Vite + Vercel.
- API: Vercel Serverless Functions, Railway, Render, or Fly.io.
- Database: Supabase or Neon Postgres.
- Auth: Supabase Auth or Clerk.
- AI: server-side DeepSeek key with limits, or user-provided API key stored per user.

## Recommended Roadmap

1. Deploy the current portfolio preview to Vercel.
2. Use the public URL for interviews and portfolio sharing.
3. Add a cloud backend and database for real personal use.
4. Keep the local-first version as a private mode for Obsidian/file-based workflows.
