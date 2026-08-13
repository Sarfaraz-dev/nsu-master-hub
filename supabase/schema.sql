-- NSU Master Hub cloud schema
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  focus text not null default '',
  lang text not null default 'Hindi/Hinglish',
  url text not null,
  kind text not null default 'YouTube',
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;
alter table public.resources enable row level security;
alter table public.user_states enable row level security;

-- Public users can read resources. Only admins can create/update/delete resources.
drop policy if exists "resources are readable" on public.resources;
create policy "resources are readable" on public.resources
  for select using (true);

drop policy if exists "admins can insert resources" on public.resources;
create policy "admins can insert resources" on public.resources
  for insert with check (exists (select 1 from public.app_admins a where a.user_id = auth.uid()));

drop policy if exists "admins can update resources" on public.resources;
create policy "admins can update resources" on public.resources
  for update using (exists (select 1 from public.app_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.app_admins a where a.user_id = auth.uid()));

drop policy if exists "admins can delete resources" on public.resources;
create policy "admins can delete resources" on public.resources
  for delete using (exists (select 1 from public.app_admins a where a.user_id = auth.uid()));

-- Each user can only see/update their own state.
drop policy if exists "users read own state" on public.user_states;
create policy "users read own state" on public.user_states
  for select using (auth.uid() = user_id);

drop policy if exists "users insert own state" on public.user_states;
create policy "users insert own state" on public.user_states
  for insert with check (auth.uid() = user_id);

drop policy if exists "users update own state" on public.user_states;
create policy "users update own state" on public.user_states
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Each authenticated user can verify only their own admin row.
drop policy if exists "users read own admin row" on public.app_admins;
create policy "users read own admin row" on public.app_admins
  for select using (auth.uid() = user_id);

-- Seed a few global resources. The UI also keeps its local curated library as a fallback.
insert into public.resources (name, focus, lang, url, kind, description)
select * from (values
  ('CodeWithHarry','C++ / Git / SQL / Web basics','Hindi','https://www.youtube.com/@CodeWithHarry','YouTube','Beginner-friendly Hindi explanations.'),
  ('Chai aur Code','C++ / OOP / Web / React','Hindi/Hinglish','https://www.youtube.com/@chaiaurcode','YouTube','Practical programming and web development.'),
  ('takeUforward (Striver)','DSA','Hinglish','https://takeuforward.org/','Website','A2Z DSA sequence and interview practice.'),
  ('CampusX','Python / Data Science / ML / DL / NLP','Hindi/Hinglish','https://www.youtube.com/@campusx-official','YouTube','Long-form Hindi/Hinglish data and AI learning.'),
  ('Kaggle Learn','Python / Pandas / Intro ML','English','https://www.kaggle.com/learn','Website','Short guided hands-on courses.'),
  ('Hugging Face Learn','Transformers / LLMs','English','https://huggingface.co/learn','Website','Official learning material for modern NLP/LLMs.'),
  ('MDN','Web platform','English','https://developer.mozilla.org/','Website','Authoritative web platform documentation.'),
  ('PyTorch Tutorials','Deep Learning','English','https://pytorch.org/tutorials/','Website','Official PyTorch tutorials.'),
  ('SQLBolt','SQL practice','English','https://sqlbolt.com/','Website','Interactive SQL exercises.'),
  ('LeetCode','DSA practice','English','https://leetcode.com/problemset/','Website','Interview-style problem practice.'),
  ('GitHub Skills','Git/GitHub','English','https://skills.github.com/','Website','Interactive GitHub learning.' )
) as v(name,focus,lang,url,kind,description)
where not exists (select 1 from public.resources r where r.name = v.name);
