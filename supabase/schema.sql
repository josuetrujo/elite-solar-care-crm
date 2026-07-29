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
-- Billing details, kept separate from the service address: the panels are at one
-- address, the bill can go elsewhere (a property manager, an HOA, a second home).
alter table customers add column if not exists billing_different boolean not null default false;
alter table customers add column if not exists billing_name text;
alter table customers add column if not exists billing_street_address text;
alter table customers add column if not exists billing_city text;
alter table customers add column if not exists billing_state text;
alter table customers add column if not exists billing_zip text;

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

-- ---------- approval gate ----------
-- A new signup gets a profile but is NOT approved, so every policy below
-- returns nothing for them until an admin approves them in Settings > Team.
-- Without this, anyone who found the public URL could create an account and
-- read the whole customer list.
alter table profiles add column if not exists approved boolean not null default false;
alter table profiles add column if not exists approved_at timestamptz;
alter table profiles add column if not exists approved_by uuid references profiles(id) on delete set null;

-- ---------- auto-create a profile when a new user signs up ----------
-- New signups default to VIEWER (read-only) AND unapproved.
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

-- helper: has an admin approved this account? Everything below hangs off this.
create or replace function is_approved() returns boolean
  language sql stable security definer set search_path = public
as $$ select coalesce((select approved from public.profiles where id = auth.uid()), false) $$;

-- profiles: you can ALWAYS read your own row (so the app can tell an unapproved
-- user they're waiting); approved admins read and manage everyone.
drop policy if exists p_profiles_self on profiles;
create policy p_profiles_self on profiles
  for select using (id = auth.uid() or (is_approved() and my_role() = 'admin'));
drop policy if exists p_profiles_admin_write on profiles;
create policy p_profiles_admin_write on profiles
  for all using (is_approved() and my_role() = 'admin')
  with check (is_approved() and my_role() = 'admin');

-- customers / jobs / invoices / reminders: everyone signed in can read;
-- admin + member can write; viewer cannot write.
do $$
declare t text;
begin
  foreach t in array array['jobs','invoices','reminders','calls'] loop
    execute format('drop policy if exists p_%1$s_read on %1$s;', t);
    execute format('create policy p_%1$s_read on %1$s for select using (is_approved());', t);
    execute format('drop policy if exists p_%1$s_write on %1$s;', t);
    execute format($f$create policy p_%1$s_write on %1$s for all
      using (is_approved() and my_role() in ('admin','member'))
      with check (is_approved() and my_role() in ('admin','member'));$f$, t);
  end loop;
end $$;

-- customers: read = any signed-in user; insert/update = admin+member; DELETE = admin only
drop policy if exists p_customers_read on customers;
create policy p_customers_read on customers for select using (is_approved());
drop policy if exists p_customers_write on customers;
drop policy if exists p_customers_ins on customers;
drop policy if exists p_customers_upd on customers;
drop policy if exists p_customers_del on customers;
create policy p_customers_ins on customers for insert
  with check (is_approved() and my_role() in ('admin','member'));
create policy p_customers_upd on customers for update
  using (is_approved() and my_role() in ('admin','member'))
  with check (is_approved() and my_role() in ('admin','member'));
create policy p_customers_del on customers for delete
  using (is_approved() and my_role() = 'admin');

-- Lock down the SECURITY DEFINER helpers: handle_new_user is a trigger function
-- and must never be callable over the REST API.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.my_role() from public, anon;
revoke all on function public.is_approved() from public, anon;
grant execute on function public.my_role() to authenticated;
grant execute on function public.is_approved() to authenticated;

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
revoke all on function log_call_disposition(uuid, call_disposition, text, timestamptz, int, numeric, text, text) from public, anon;
grant execute on function log_call_disposition(uuid, call_disposition, text, timestamptz, int, numeric, text, text) to authenticated;

-- ============================================================================
-- AFTER RUNNING: make yourself the admin.
-- 1. Sign up in the app (or Supabase > Authentication > Users > Add user).
-- 2. Then run, replacing the email:
--      update profiles set role = 'admin', approved = true, approved_at = now()
--      where email = 'you@example.com';
-- Everyone after you signs up normally and waits for you to approve them
-- in the app under Settings > Team.
-- ============================================================================

-- ============================================================================
-- Job photos (before/after). Files live in a PRIVATE storage bucket because
-- they show customers' homes; the app reads them via short-lived signed URLs.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-photos', 'job-photos', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  path text not null,
  kind text not null default 'after',       -- before | after
  caption text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists idx_job_photos_job on job_photos(job_id);
create index if not exists idx_job_photos_customer on job_photos(customer_id);

alter table job_photos enable row level security;
drop policy if exists p_job_photos_read on job_photos;
create policy p_job_photos_read on job_photos for select using (is_approved());
drop policy if exists p_job_photos_write on job_photos;
create policy p_job_photos_write on job_photos for all
  using (is_approved() and my_role() in ('admin','member'))
  with check (is_approved() and my_role() in ('admin','member'));

drop policy if exists p_jobphoto_obj_read on storage.objects;
create policy p_jobphoto_obj_read on storage.objects for select
  using (bucket_id = 'job-photos' and is_approved());
drop policy if exists p_jobphoto_obj_ins on storage.objects;
create policy p_jobphoto_obj_ins on storage.objects for insert
  with check (bucket_id = 'job-photos' and is_approved() and my_role() in ('admin','member'));
drop policy if exists p_jobphoto_obj_del on storage.objects;
create policy p_jobphoto_obj_del on storage.objects for delete
  using (bucket_id = 'job-photos' and is_approved() and my_role() in ('admin','member'));

-- ============================================================================
-- List hygiene: find contacts entered twice (matched on a normalised phone),
-- and merge one into another in a single transaction.
-- ============================================================================
create or replace function find_duplicate_contacts()
returns table (phone_key text, ids uuid[], names text[], n int)
  language sql stable security invoker set search_path = public
as $$
  with norm as (
    select id, full_name,
      case
        when length(regexp_replace(coalesce(phone,''), '\D', '', 'g')) = 11
             and left(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 1) = '1'
          then right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 10)
        when length(regexp_replace(coalesce(phone,''), '\D', '', 'g')) = 10
          then regexp_replace(coalesce(phone,''), '\D', '', 'g')
        else null
      end as pk
    from customers
  )
  select pk, array_agg(id order by full_name), array_agg(coalesce(full_name,'(no name)') order by full_name), count(*)::int
  from norm where pk is not null
  group by pk having count(*) > 1
  order by count(*) desc, pk;
$$;

create or replace function merge_customers(p_keep uuid, p_drop uuid)
returns void
  language plpgsql security invoker set search_path = public
as $$
begin
  if p_keep = p_drop then raise exception 'Cannot merge a contact into itself'; end if;

  update calls      set customer_id = p_keep where customer_id = p_drop;
  update jobs       set customer_id = p_keep where customer_id = p_drop;
  update invoices   set customer_id = p_keep where customer_id = p_drop;
  update reminders  set customer_id = p_keep where customer_id = p_drop;

  update customers k set
    first_name      = coalesce(nullif(btrim(k.first_name),''), d.first_name),
    last_name       = coalesce(nullif(btrim(k.last_name),''),  d.last_name),
    full_name       = coalesce(nullif(btrim(k.full_name),''),  d.full_name),
    email           = coalesce(nullif(btrim(k.email),''),      d.email),
    phone           = coalesce(nullif(btrim(k.phone),''),      d.phone),
    street_address  = coalesce(nullif(btrim(k.street_address),''), d.street_address),
    city            = coalesce(nullif(btrim(k.city),''),       d.city),
    state           = coalesce(nullif(btrim(k.state),''),      d.state),
    zip             = coalesce(nullif(btrim(k.zip),''),        d.zip),
    panel_count     = coalesce(k.panel_count,     d.panel_count),
    stories         = coalesce(k.stories,         d.stories),
    roof_type       = coalesce(nullif(btrim(k.roof_type),''),  d.roof_type),
    lead_source     = coalesce(nullif(btrim(k.lead_source),''), d.lead_source),
    quoted_amount   = coalesce(k.quoted_amount,   d.quoted_amount),
    next_service_due= coalesce(k.next_service_due, d.next_service_due),
    hubspot_id      = coalesce(k.hubspot_id,      d.hubspot_id),
    do_not_call     = k.do_not_call or d.do_not_call,
    bad_number      = k.bad_number and d.bad_number,
    consent_sms     = k.consent_sms or d.consent_sms,
    consent_email   = k.consent_email or d.consent_email,
    call_attempts   = k.call_attempts + d.call_attempts,
    last_call_at    = greatest(coalesce(k.last_call_at, '-infinity'::timestamptz),
                               coalesce(d.last_call_at, '-infinity'::timestamptz)),
    last_disposition = case when coalesce(d.last_call_at,'-infinity'::timestamptz)
                                 > coalesce(k.last_call_at,'-infinity'::timestamptz)
                            then d.last_disposition else k.last_disposition end,
    callback_at     = coalesce(k.callback_at, d.callback_at),
    notes           = nullif(btrim(concat_ws(E'\n', nullif(btrim(k.notes),''), nullif(btrim(d.notes),''))), '')
  from customers d
  where k.id = p_keep and d.id = p_drop;

  delete from customers where id = p_drop;
end;
$$;

-- ============================================================================
-- Numbers for the Reports screen, computed in the database.
-- ============================================================================
create or replace function crm_report()
returns jsonb
  language sql stable security invoker set search_path = public
as $$
  select jsonb_build_object(
    'revenue_by_month', (
      select coalesce(jsonb_agg(t order by t.month), '[]'::jsonb) from (
        select to_char(date_trunc('month', coalesce(paid_date, created_at::date)), 'YYYY-MM') as month,
               sum(amount)::numeric as total, count(*)::int as jobs
        from invoices where status = 'paid' group by 1
      ) t
    ),
    'outstanding', (select coalesce(sum(amount),0)::numeric from invoices where status in ('unpaid','sent')),
    'collected',   (select coalesce(sum(amount),0)::numeric from invoices where status = 'paid'),
    'avg_ticket',  (select coalesce(avg(amount),0)::numeric from invoices where status = 'paid'),
    'calls_total', (select count(*)::int from calls),
    'calls_by_outcome', (
      select coalesce(jsonb_object_agg(disposition, n), '{}'::jsonb) from (
        select disposition::text, count(*)::int as n from calls group by 1
      ) c
    ),
    'contacts_total',  (select count(*)::int from customers),
    'customers_total', (select count(*)::int from customers
                        where not do_not_call and not bad_number
                          and status in ('customer','scheduled','completed','recurring')),
    'leads_total',     (select count(*)::int from customers
                        where not do_not_call and not bad_number and status in ('new_lead','quoted')),
    'jobs_completed',  (select count(*)::int from jobs where status = 'completed'),
    'jobs_scheduled',  (select count(*)::int from jobs where status = 'scheduled'),
    'unreachable',     (select count(*)::int from customers
                        where length(regexp_replace(coalesce(phone,''), '\D', '', 'g')) not in (10, 11))
  );
$$;

revoke all on function find_duplicate_contacts() from public, anon;
revoke all on function merge_customers(uuid, uuid) from public, anon;
revoke all on function crm_report() from public, anon;
grant execute on function find_duplicate_contacts() to authenticated;
grant execute on function merge_customers(uuid, uuid) to authenticated;
grant execute on function crm_report() to authenticated;
