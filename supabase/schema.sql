-- ============================================================================
-- Elite Solar Care CRM — Supabase database schema
-- ----------------------------------------------------------------------------
-- HOW TO RUN (beginner steps):
--   1. Create a free project at https://supabase.com
--   2. In the project, open the "SQL Editor" (left menu).
--   3. Click "New query", paste this whole file, and click "Run".
--   4. It creates the tables, roles, and security rules below.
-- Safe to run more than once.
-- ============================================================================

-- ---------- ENUM types (fixed lists of values) ----------
do $$ begin
  create type pipeline_status as enum
    ('new_lead','quoted','scheduled','completed','recurring','lost','not_interested','customer');
exception when duplicate_object then null; end $$;
-- if the type already existed without the calling statuses, add them (run these
-- two lines on their own in the SQL editor if needed; they can't run inside a txn):
-- alter type pipeline_status add value if not exists 'not_interested';
-- alter type pipeline_status add value if not exists 'customer';

do $$ begin
  create type user_role as enum ('admin','member','viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type call_disposition as enum
    ('no_answer','voicemail','busy','call_later','not_interested','bad_number','dnc','sale');
exception when duplicate_object then null; end $$;

-- ---------- profiles: one row per logged-in user, holds their role ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  role user_role not null default 'member',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- customers ----------
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  full_name text,
  email text,
  phone text,
  street_address text,
  city text,
  state text,
  zip text,
  property_type text default 'residential',   -- residential | commercial
  panel_count int,
  system_kw numeric,
  stories int,
  roof_type text,
  lead_source text,                            -- e.g. 'Quality First list', 'referral'
  status pipeline_status not null default 'new_lead',
  quoted_amount numeric,
  recurring_frequency text default 'twice_a_year', -- twice_a_year | quarterly | annually | none
  next_service_due date,
  consent_sms boolean not null default false,  -- legal opt-in before texting
  consent_email boolean not null default false,
  -- calling workflow
  do_not_call boolean not null default false,
  bad_number boolean not null default false,
  callback_at timestamptz,
  last_call_at timestamptz,
  last_disposition text,
  call_attempts int not null default 0,
  hubspot_id text,                             -- trace back to HubSpot record
  source text,                                 -- where the contact came from
  notes text,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_customers_status on customers(status);
create index if not exists idx_customers_due on customers(next_service_due);
create index if not exists idx_customers_callback on customers(callback_at);
-- (re-run friendly) add calling columns if the table already existed
alter table customers add column if not exists do_not_call boolean not null default false;
alter table customers add column if not exists bad_number boolean not null default false;
alter table customers add column if not exists callback_at timestamptz;
alter table customers add column if not exists last_call_at timestamptz;
alter table customers add column if not exists last_disposition text;
alter table customers add column if not exists call_attempts int not null default 0;
alter table customers add column if not exists hubspot_id text;
alter table customers add column if not exists source text;
create index if not exists idx_customers_hubspot on customers(hubspot_id);

-- ---------- calls (one row per call attempt = full history) ----------
create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  called_at timestamptz not null default now(),
  disposition call_disposition not null,
  note text,
  callback_at timestamptz,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists idx_calls_customer on calls(customer_id);
create index if not exists idx_calls_called_at on calls(called_at);

-- ---------- jobs (service history / scheduled visits) ----------
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  scheduled_date date,
  completed_date date,
  crew text,
  work_done text,
  amount numeric,
  status text default 'scheduled',             -- scheduled | completed | canceled
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_jobs_customer on jobs(customer_id);

-- ---------- invoices (payments; Square link stored when enabled) ----------
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  amount numeric not null,
  status text default 'unpaid',                -- unpaid | sent | paid | void
  square_invoice_id text,
  square_pay_url text,
  due_date date,
  paid_date date,
  created_at timestamptz not null default now()
);

-- Human-friendly receipt numbers (ESC-1002, ESC-1003, …). The first paper
-- receipts issued by hand ended at ESC-1002, so the sequence carries on from there.
create sequence if not exists receipt_no_seq start with 1003;
alter table invoices add column if not exists receipt_no int not null default nextval('receipt_no_seq');
alter table invoices add column if not exists description text;      -- "Solar Panel Cleaning"
alter table invoices add column if not exists payment_method text;    -- cash | check | card | other
alter table invoices add column if not exists check_no text;
alter table invoices add column if not exists discount numeric not null default 0;
alter table invoices add column if not exists tax numeric not null default 0;
alter table invoices add column if not exists notes text;
create index if not exists idx_invoices_customer on invoices(customer_id);
create unique index if not exists idx_invoices_receipt_no on invoices(receipt_no);

-- ---------- reminders log (so we don't double-send) ----------
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  channel text not null,                        -- sms | email
  kind text not null,                           -- service_due | quote_followup
  sent_at timestamptz not null default now(),
  status text default 'sent'
);

-- ---------- keep updated_at fresh on customers ----------
create or replace function set_updated_at() returns trigger
  language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_customers_updated on customers;
create trigger trg_customers_updated before update on customers
  for each row execute function set_updated_at();

-- ---------- auto-create a profile when a new user signs up ----------
-- New signups default to VIEWER (read-only). An admin promotes to member/admin.
create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email), new.email, 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- ROW-LEVEL SECURITY (permissions)
-- Rule of thumb:
--   admin  -> full access + can manage users
--   member -> can read/write customers, jobs, invoices
--   viewer -> read-only
-- ============================================================================
alter table profiles  enable row level security;
alter table customers enable row level security;
alter table jobs      enable row level security;
alter table invoices  enable row level security;
alter table reminders enable row level security;
alter table calls     enable row level security;

-- helper: current user's role
create or replace function my_role() returns user_role
  language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

-- profiles: a user can see their own profile; admins see all and can edit roles
drop policy if exists p_profiles_self on profiles;
create policy p_profiles_self on profiles
  for select using (id = auth.uid() or my_role() = 'admin');
drop policy if exists p_profiles_admin_write on profiles;
create policy p_profiles_admin_write on profiles
  for all using (my_role() = 'admin') with check (my_role() = 'admin');

-- customers / jobs / invoices / reminders: everyone signed in can read;
-- admin + member can write; viewer cannot write.
do $$
declare t text;
begin
  foreach t in array array['jobs','invoices','reminders','calls'] loop
    execute format('drop policy if exists p_%1$s_read on %1$s;', t);
    execute format('create policy p_%1$s_read on %1$s for select using (auth.uid() is not null);', t);
    execute format('drop policy if exists p_%1$s_write on %1$s;', t);
    execute format($f$create policy p_%1$s_write on %1$s for all
      using (my_role() in ('admin','member')) with check (my_role() in ('admin','member'));$f$, t);
  end loop;
end $$;

-- customers: read = any signed-in user; insert/update = admin+member; DELETE = admin only
drop policy if exists p_customers_read on customers;
create policy p_customers_read on customers for select using (auth.uid() is not null);
drop policy if exists p_customers_write on customers;
drop policy if exists p_customers_ins on customers;
drop policy if exists p_customers_upd on customers;
drop policy if exists p_customers_del on customers;
create policy p_customers_ins on customers for insert with check (my_role() in ('admin','member'));
create policy p_customers_upd on customers for update using (my_role() in ('admin','member')) with check (my_role() in ('admin','member'));
create policy p_customers_del on customers for delete using (my_role() = 'admin');

-- ============================================================================
-- Transactional call logging (insert call + patch customer atomically).
-- The app calls this via RPC so a partial failure can't desync the data.
-- ============================================================================
create or replace function log_call_disposition(
  p_customer_id uuid,
  p_disposition call_disposition,
  p_note text default null,
  p_callback_at timestamptz default null,
  p_sale_panel_count int default null,
  p_sale_amount numeric default null,
  p_sale_recurring text default null,
  p_sale_notes text default null
) returns void
  language plpgsql security invoker set search_path = public
as $$
begin
  insert into calls (customer_id, called_at, disposition, note, callback_at, created_by)
  values (p_customer_id, now(), p_disposition, p_note,
          case when p_disposition = 'call_later' then p_callback_at end, auth.uid());
  update customers set
    last_call_at = now(),
    last_disposition = p_disposition::text,
    call_attempts = call_attempts + 1,
    callback_at = case
      when p_disposition = 'call_later' then p_callback_at
      when p_disposition in ('sale','dnc','bad_number','not_interested') then null
      else callback_at end,
    status = case when p_disposition = 'not_interested' then 'not_interested'::pipeline_status
                  when p_disposition = 'sale' then 'customer'::pipeline_status else status end,
    bad_number  = case when p_disposition = 'bad_number' then true else bad_number end,
    do_not_call = case when p_disposition = 'dnc' then true else do_not_call end,
    panel_count = case when p_disposition = 'sale' and p_sale_panel_count is not null then p_sale_panel_count else panel_count end,
    quoted_amount = case when p_disposition = 'sale' and p_sale_amount is not null then p_sale_amount else quoted_amount end,
    recurring_frequency = case when p_disposition = 'sale' and p_sale_recurring is not null then p_sale_recurring else recurring_frequency end,
    notes = case when p_disposition = 'sale' and coalesce(p_sale_notes,'') <> ''
                 then coalesce(notes || ' | ', '') || p_sale_notes else notes end
  where id = p_customer_id;
end;
$$;
grant execute on function log_call_disposition(uuid, call_disposition, text, timestamptz, int, numeric, text, text) to authenticated;

-- ============================================================================
-- AFTER RUNNING: make yourself the admin.
-- 1. Sign up in the app (or Supabase > Authentication > Users > Add user).
-- 2. Then run, replacing the email:
--      update profiles set role = 'admin' where email = 'you@example.com';
-- ============================================================================
