-- Folders (nestable)
create table public.folders (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  name       text not null,
  parent_id  uuid references public.folders(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.folders enable row level security;
create policy "own folders" on public.folders
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Meetings (one per Google Meet session, user-named)
create table public.meetings (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade not null,
  folder_id      uuid references public.folders(id) on delete set null,
  title          text not null,
  meet_room_code text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
alter table public.meetings enable row level security;
create policy "own meetings" on public.meetings
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Saved items
create table public.saved_items (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  meeting_id  uuid references public.meetings(id) on delete cascade not null,
  type        text not null check (type in ('url','qr_code','email','phone','event','contact')),
  data        jsonb not null,
  created_at  timestamptz default now()
);
alter table public.saved_items enable row level security;
create policy "own saved_items" on public.saved_items
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index on public.meetings(user_id, created_at desc);
create index on public.saved_items(meeting_id);
create index on public.saved_items(user_id, type);
