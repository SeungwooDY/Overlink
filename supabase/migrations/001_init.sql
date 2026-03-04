-- Auto-create profile row on user signup
create table public.profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  email      text,
  full_name  text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles
  using (auth.uid() = id) with check (auth.uid() = id);

create function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles(id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Subscription state synced from Stripe webhooks
create table public.subscriptions (
  id                      uuid default gen_random_uuid() primary key,
  user_id                 uuid references auth.users(id) on delete cascade not null unique,
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  plan                    text not null default 'free',
  status                  text not null default 'active',
  current_period_end      timestamptz,
  updated_at              timestamptz default now()
);
alter table public.subscriptions enable row level security;
create policy "own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Claude API call usage per billing period (cap: 1,000 calls/month)
create table public.usage (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  period_start timestamptz not null,
  calls_used   integer default 0,
  unique(user_id, period_start)
);
alter table public.usage enable row level security;
create policy "own usage" on public.usage
  for select using (auth.uid() = user_id);
