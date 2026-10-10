-- Tubify cloud library. Run once in Supabase → SQL Editor.
-- Every table is per-user and locked down with row-level security.

create table if not exists public.likes (
  user_id   uuid not null default auth.uid() references auth.users on delete cascade,
  track_id  text not null,
  title     text not null,
  artist    text not null default '',
  duration  int  not null default 0,
  added_at  timestamptz not null default now(),
  primary key (user_id, track_id)
);

create table if not exists public.playlists (
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  id          text not null,
  name        text not null,
  description text not null default '',
  tracks      jsonb not null default '[]' check (jsonb_typeof(tracks) = 'array'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

-- Listening events: one row per listen/skip (bulk imports carry counts > 1). Input for recommendations.
create table if not exists public.plays (
  id        bigint generated always as identity primary key,
  user_id   uuid not null default auth.uid() references auth.users on delete cascade,
  cid       uuid not null default gen_random_uuid(), -- client id: retried uploads are ignored, not double-counted
  track_id  text not null,
  title     text not null,
  artist    text not null default '',
  duration  int  not null default 0,
  played    int  not null default 0 check (played >= 0),
  skipped   int  not null default 0 check (skipped >= 0),
  at        timestamptz not null default now(),
  unique (user_id, cid)
);
create index if not exists plays_user_at on public.plays (user_id, at desc);
create index if not exists plays_user_track on public.plays (user_id, track_id);

-- Small synced settings: recent searches, recently played, autoplay, …
create table if not exists public.user_prefs (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- Per-track taste summary, computed from plays. security_invoker → RLS of the caller applies.
create or replace view public.track_stats with (security_invoker = true) as
select
  user_id,
  track_id,
  (array_agg(title    order by at desc))[1] as title,
  (array_agg(artist   order by at desc))[1] as artist,
  (array_agg(duration order by at desc))[1] as duration,
  sum(played)::int  as n,
  sum(skipped)::int as skips,
  max(at)           as last
from public.plays
group by user_id, track_id;

alter table public.likes      enable row level security;
alter table public.playlists  enable row level security;
alter table public.plays      enable row level security;
alter table public.user_prefs enable row level security;

drop policy if exists "own likes" on public.likes;
create policy "own likes" on public.likes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own playlists" on public.playlists;
create policy "own playlists" on public.playlists for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own plays" on public.plays;
create policy "own plays" on public.plays for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own prefs" on public.user_prefs;
create policy "own prefs" on public.user_prefs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.likes, public.playlists, public.plays, public.user_prefs, public.track_stats from anon;
grant select, insert, update, delete on public.likes, public.playlists, public.plays, public.user_prefs to authenticated;
grant select on public.track_stats to authenticated;
