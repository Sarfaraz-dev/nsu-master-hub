# NSU Master Hub v0.5

A data-driven NSU CSE (AI & ML) learning OS with optional Supabase cloud sync and a protected Admin Console for resource maintenance.

## Run locally

```bash
npm install
npm run dev
```

## Add Supabase

1. Create a project at https://supabase.com/.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. Create `.env.local` from `.env.example` and paste your project URL + anon key.
4. Restart `npm run dev`.
5. In the app open **Settings → Cloud sync → Create account**.
6. In Supabase Dashboard → **Authentication → Users**, copy the new user's UUID.
7. In SQL Editor, replace `USER_UUID_HERE` in `supabase/seed-admin.sql` and run it.
8. Sign out/in or refresh the app. The **Admin Console** appears only for that admin user.

## Vercel

Add these Project Environment Variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Connect the GitHub repository once. Future pushes to the connected branch trigger Vercel deployments automatically.

## Admin workflow

Open **Admin Console** → add/edit/delete resources. Resource changes live in Supabase and do not require changing the React code or manually redeploying Vercel.

## Security

Never put a Supabase service-role key in the browser or in any `VITE_*` variable. The browser uses the publishable/anon key with Row Level Security (RLS).
