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

YayaMind now supports a first cloud-backed mode:

```text
Vercel frontend
+ Vercel /api serverless functions
+ Supabase storage table
+ optional DeepSeek API key
```

In this mode, the same `/api/*` routes run on Vercel. Local development still writes to `personal-assistant-data/`; production writes to Supabase when the environment variables below are set.

### Supabase Setup

Create a Supabase project. This part must be done in the user's own Supabase account because it creates private database credentials.

Then run this SQL in the Supabase SQL editor:

```sql
create table if not exists public.yayamind_store (
  key text primary key,
  content text not null,
  updated_at timestamptz not null default now()
);
```

### Supabase Auth Setup

YayaMind uses Supabase email/password auth.

In Supabase:

1. Go to `Authentication` -> `Providers`.
2. Enable `Email`.
3. For the easiest first deployment, turn off email confirmation:
   - `Authentication` -> `Sign In / Providers` -> `Email`
   - Disable `Confirm email`
4. If email confirmation stays enabled, the first registered account must confirm email before login works.

Each account gets its own data namespace in `yayamind_store`, so logging out and logging into another account switches to another dataset.

### Vercel Environment Variables

Add these backend variables in Vercel:

```text
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your Supabase service_role key>
SUPABASE_YAYAMIND_TABLE=yayamind_store
```

Add these frontend variables in Vercel:

```text
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your Supabase anon public key>
```

Optional AI variables:

```text
DEEPSEEK_API_KEY=<your DeepSeek key>
DEEPSEEK_MODEL=deepseek-chat
```

Important:

- Use `service_role` only in Vercel environment variables, never in frontend code.
- Only the public anon key should use `VITE_`.
- After changing environment variables, redeploy the Vercel project.

### Current Cloud Scope

This is an account-based cloud mode.

Behavior:

- If Supabase env vars are not configured, the public Vercel URL shows demo data.
- If Supabase env vars are configured, the public Vercel URL shows a login/register screen.
- Logged-in users can write their own cloud data.
- The sidebar has a logout button for switching accounts.

Next production step:

- Later split the single storage table into normalized event/task/reminder tables if multi-user use becomes important.

## Recommended Roadmap

1. Deploy the current portfolio preview to Vercel.
2. Use the public URL for interviews and portfolio sharing.
3. Enable Supabase Email Auth.
4. Add Supabase environment variables in Vercel.
4. Redeploy and test `/api/bootstrap`.
5. Register the first account from the YayaMind login page.
6. Keep the local-first version as a private mode for Obsidian/file-based workflows.
