# OpCertMS — Operation Certificate Management System

## Deploy to Vercel

1. Upload this folder to GitHub
2. Import repo in Vercel
3. Settings → Environment Variables → add:
   - `SUPABASE_URL` = your Supabase project URL
   - `SUPABASE_KEY` = your Supabase anon key
4. Redeploy

## Supabase Setup

1. Create project at supabase.com (free tier)
2. SQL Editor → run `supabase_schema.sql`
3. Settings → API → copy URL + anon key

## Default Accounts
| Username | Password | Role |
|----------|----------|------|
| admin    | admin123 | Admin (full access) |
| trainer  | trainer123 | Trainer (certs only) |
| viewer   | viewer123 | Viewer (read-only) |
