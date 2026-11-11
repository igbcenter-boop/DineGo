-- =====================================================================
-- DineGo — schéma initial
-- Marketplace de restauration et de livraison (Burkina Faso)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------
create type public.user_role as enum ('client', 'restaurant', 'livreur', 'admin');
create type public.account_status as enum ('active', 'suspended');
create type public.restaurant_status as enum ('pending', 'active', 'suspended', 'rejected');
create type public.collection_mode as enum ('dinego', 'restaurant');
create type public.remittance_frequency as enum ('daily', 'weekly');
create type public.order_mode as enum ('delivery', 'pickup');
create type public.order_status as enum (
  'sent', 'received', 'accepted', 'preparing', 'ready',
  'awaiting_pickup', 'delivering', 'handed_over', 'completed',
  'refused', 'cancelled', 'not_delivered'
);
create type public.payment_method as enum ('orange_money', 'moov_money', 'other_mobile_money', 'card', 'cash');
create type public.payment_status as enum ('pending', 'confirmed', 'failed', 'cancelled', 'refunded', 'partially_refunded');
create type public.courier_network as enum ('restaurant', 'dinego');
create type public.courier_status as enum ('pending', 'active', 'suspended');
create type public.mission_status as enum ('proposed', 'accepted', 'refused', 'picked_up', 'arrived', 'delivered', 'cancelled');
create type public.settlement_direction as enum ('to_dinego', 'to_restaurant');
create type public.settlement_status as enum ('pending', 'partial', 'paid', 'late');
create type public.ticket_status as enum ('open', 'in_progress', 'resolved', 'rejected');
create type public.refund_status as enum ('requested', 'approved', 'rejected', 'paid');

-- ---------------------------------------------------------------------
-- Référentiels
-- ---------------------------------------------------------------------
create table public.zones (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (city, name)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  icon text not null default '🍽️',
  sort int not null default 100,
  active boolean not null default true
);

-- ---------------------------------------------------------------------
-- Utilisateurs
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'client',
  full_name text not null default '',
  phone text,
  email text,
  status public.account_status not null default 'active',
  created_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default 'Domicile',
  city text not null,
  zone text,
  details text not null,
  phone text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Restaurants
-- ---------------------------------------------------------------------
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  name text not null,
  slug text not null unique,
  manager_name text not null,
  phone text not null,
  email text,
  address text not null,
  city text not null,
  zone_id uuid references public.zones (id),
  category_id uuid references public.categories (id),
  cuisine_type text,
  description text,
  logo_url text,
  cover_url text,
  opening_hours text,
  opens_at time,
  closes_at time,
  delivery_zones text,
  delivery_conditions text,
  price_level smallint not null default 2 check (price_level between 1 and 3),
  offers_delivery boolean not null default true,
  offers_pickup boolean not null default true,
  accepts_scheduled boolean not null default false,
  accepts_reservations boolean not null default false,
  is_open boolean not null default true,
  financial_info text,
  status public.restaurant_status not null default 'pending',
  collection_mode public.collection_mode not null default 'dinego',
  remittance_frequency public.remittance_frequency not null default 'weekly',
  rating_avg numeric(3, 2) not null default 0,
  rating_count int not null default 0,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  validated_at timestamptz
);
create index on public.restaurants (status);
create index on public.restaurants (owner_id);

-- Historique daté des changements de mode d'encaissement / fréquence (§8.4, §9.5)
create table public.restaurant_setting_changes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  field text not null,
  old_value text,
  new_value text,
  changed_by uuid references public.profiles (id),
  changed_at timestamptz not null default now()
);

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  sort int not null default 100
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  menu_category_id uuid references public.menu_categories (id) on delete set null,
  name text not null,
  description text,
  price int not null check (price >= 0),
  photo_url text,
  available boolean not null default true,
  is_combo boolean not null default false,
  options jsonb not null default '[]'::jsonb, -- [{ "name": "Supplément frites", "price": 500 }]
  views int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.products (restaurant_id);

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  product_id uuid references public.products (id) on delete cascade,
  title text not null,
  description text,
  conditions text not null,
  discount_percent int not null check (discount_percent between 1 and 90),
  min_order int not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Livreurs
-- ---------------------------------------------------------------------
create table public.couriers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles (id) on delete set null,
  restaurant_id uuid references public.restaurants (id) on delete cascade,
  network public.courier_network not null,
  full_name text not null,
  phone text not null,
  zone_id uuid references public.zones (id),
  vehicle text,
  id_document text,
  status public.courier_status not null default 'pending',
  available boolean not null default true,
  created_at timestamptz not null default now(),
  check ((network = 'restaurant' and restaurant_id is not null) or (network = 'dinego' and restaurant_id is null))
);

-- ---------------------------------------------------------------------
-- Paramétrage des frais (versionné, jamais rétroactif — §7.4)
-- ---------------------------------------------------------------------
create table public.fee_settings (
  id uuid primary key default gen_random_uuid(),
  commission_percent numeric(5, 2) not null default 10,     -- % du montant des produits revenant à DineGo
  management_fee int not null default 0,                    -- frais de gestion fixes payés par le client
  delivery_fee int not null default 500,                    -- frais de livraison facturés au client
  courier_share_percent numeric(5, 2) not null default 100, -- part des frais de livraison revenant au livreur
  zone_rules jsonb not null default '{}'::jsonb,            -- { "<zone_id>": { "delivery_fee": 700 } }
  category_rules jsonb not null default '{}'::jsonb,        -- { "<category_id>": { "commission_percent": 8 } }
  note text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Commandes
-- ---------------------------------------------------------------------
create sequence public.order_number_seq start 1000;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('DG-' || nextval('public.order_number_seq')::text),
  client_id uuid not null references public.profiles (id),
  restaurant_id uuid not null references public.restaurants (id),
  mode public.order_mode not null,
  address text,
  zone_id uuid references public.zones (id),
  contact_phone text not null,
  notes text,
  scheduled_for timestamptz,
  status public.order_status not null default 'sent',
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'pending',
  subtotal int not null,
  discount int not null default 0,
  delivery_fee int not null default 0,
  management_fee int not null default 0,
  total int not null,
  prep_minutes int,
  refuse_reason text,
  cancel_reason text,
  cancelled_by uuid references public.profiles (id),
  courier_id uuid references public.couriers (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index on public.orders (client_id);
create index on public.orders (restaurant_id);
create index on public.orders (courier_id);
create index on public.orders (created_at);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  unit_price int not null,
  quantity int not null check (quantity > 0),
  options jsonb not null default '[]'::jsonb,
  line_total int not null
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  actor_id uuid references public.profiles (id),
  note text,
  created_at timestamptz not null default now()
);

-- Ventilation financière interne (§7) — jamais visible par le client
create table public.order_financials (
  order_id uuid primary key references public.orders (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id),
  fee_setting_id uuid references public.fee_settings (id),
  collection_mode public.collection_mode not null,
  collector text not null check (collector in ('dinego', 'restaurant')),
  courier_network public.courier_network,
  commission_percent numeric(5, 2) not null,
  restaurant_share int not null,
  courier_share int not null,
  dinego_share int not null,
  expected_amount int not null,
  collected_amount int not null default 0,
  settlement_id uuid,
  confirmed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Paiements & encaissements
-- ---------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  amount int not null,
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  reference text,
  provider_reference text,
  beneficiary text not null check (beneficiary in ('dinego', 'restaurant')),
  confirmed_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Confirmation numérique des encaissements en espèces (§10) — une seule par commande
create table public.cash_confirmations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  amount int not null,
  method public.payment_method not null default 'cash',
  confirmed_by uuid not null references public.profiles (id),
  confirmer_role public.user_role not null,
  reference text,
  created_at timestamptz not null default now()
);

create table public.cash_corrections (
  id uuid primary key default gen_random_uuid(),
  confirmation_id uuid not null references public.cash_confirmations (id) on delete cascade,
  old_amount int not null,
  new_amount int not null,
  reason text not null,
  corrected_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.anomalies (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete cascade,
  kind text not null default 'cash_gap', -- cash_gap | payment | other
  expected_amount int,
  received_amount int,
  description text not null,
  reported_by uuid references public.profiles (id),
  status public.ticket_status not null default 'open',
  resolution text,
  resolved_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Reversements (§9) : restaurant -> DineGo et DineGo -> restaurant
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  direction public.settlement_direction not null,
  frequency public.remittance_frequency not null,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  amount_due int not null,
  amount_paid int not null default 0,
  status public.settlement_status not null default 'pending',
  created_at timestamptz not null default now()
);
alter table public.order_financials
  add constraint order_financials_settlement_fk foreign key (settlement_id) references public.settlements (id) on delete set null;

create table public.settlement_payments (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements (id) on delete cascade,
  amount int not null check (amount > 0),
  proof text not null,
  recorded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Rémunération des livreurs (§6.4)
create table public.courier_earnings (
  id uuid primary key default gen_random_uuid(),
  courier_id uuid not null references public.couriers (id) on delete cascade,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  amount int not null,
  paid_by text not null check (paid_by in ('restaurant', 'dinego')),
  status text not null default 'due' check (status in ('due', 'paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- Missions de livraison
create table public.delivery_missions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  courier_id uuid not null references public.couriers (id) on delete cascade,
  status public.mission_status not null default 'proposed',
  refuse_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.delivery_missions (courier_id);

-- ---------------------------------------------------------------------
-- Avis, réclamations, incidents, remboursements
-- ---------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  author_name text,
  rating_restaurant smallint not null check (rating_restaurant between 1 and 5),
  rating_service smallint not null check (rating_service between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('retard', 'incomplete', 'produit_incorrect', 'qualite', 'non_recue', 'paiement', 'autre')),
  description text not null,
  status public.ticket_status not null default 'open',
  response text,
  responded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  reported_by uuid not null references public.profiles (id),
  type text not null default 'non_livree',
  reason text not null,
  status public.ticket_status not null default 'open',
  resolution text,
  created_at timestamptz not null default now()
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  complaint_id uuid references public.complaints (id) on delete set null,
  amount int not null check (amount > 0),
  reason text not null,
  status public.refund_status not null default 'requested',
  processed_by uuid references public.profiles (id),
  processing_note text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

-- ---------------------------------------------------------------------
-- Notifications, réservations, journal d'audit
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, read);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  reserved_for timestamptz not null,
  people int not null check (people between 1 and 50),
  note text,
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'declined', 'cancelled')),
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id),
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Fonctions utilitaires
-- =====================================================================
create or replace function public.current_role_name()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active')
$$;

create or replace function public.owns_restaurant(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.restaurants where id = rid and owner_id = auth.uid())
$$;

create or replace function public.my_courier_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.couriers where user_id = auth.uid()
$$;

create or replace function public.courier_sees_order(oid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o where o.id = oid and o.courier_id in (select id from public.couriers where user_id = auth.uid())
  ) or exists (
    select 1 from public.delivery_missions m
    join public.couriers c on c.id = m.courier_id
    where m.order_id = oid and c.user_id = auth.uid()
  )
$$;

-- Création automatique du profil à l'inscription (le rôle admin ne peut jamais être demandé)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  requested text := coalesce(new.raw_user_meta_data ->> 'role', 'client');
begin
  if requested not in ('client', 'restaurant', 'livreur') then
    requested := 'client';
  end if;
  insert into public.profiles (id, role, full_name, phone, email)
  values (
    new.id,
    requested::public.user_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone',
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Recalcul de la note moyenne
create or replace function public.refresh_restaurant_rating()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.restaurants r set
    rating_avg = coalesce((select round(avg(rating_restaurant)::numeric, 2) from public.reviews where restaurant_id = r.id), 0),
    rating_count = (select count(*) from public.reviews where restaurant_id = r.id)
  where r.id = coalesce(new.restaurant_id, old.restaurant_id);
  return null;
end;
$$;

create trigger reviews_rating_refresh
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_restaurant_rating();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();
create trigger payments_touch before update on public.payments for each row execute function public.touch_updated_at();
create trigger missions_touch before update on public.delivery_missions for each row execute function public.touch_updated_at();

-- Compteur de consultations des plats (appelable par tous, n'incrémente qu'un compteur)
create or replace function public.increment_product_views(pids uuid[])
returns void language sql security definer set search_path = public as $$
  update public.products set views = views + 1 where id = any (pids);
$$;
grant execute on function public.increment_product_views(uuid[]) to anon, authenticated;

-- =====================================================================
-- Sécurité : Row Level Security
-- Lecture : contrôlée par RLS. Écriture : uniquement via le serveur
-- applicatif (clé service) après contrôle du rôle, sauf mention.
-- =====================================================================
alter table public.zones enable row level security;
alter table public.categories enable row level security;
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.restaurants enable row level security;
alter table public.restaurant_setting_changes enable row level security;
alter table public.menu_categories enable row level security;
alter table public.products enable row level security;
alter table public.promotions enable row level security;
alter table public.couriers enable row level security;
alter table public.fee_settings enable row level security;
alter table public.platform_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.order_financials enable row level security;
alter table public.payments enable row level security;
alter table public.cash_confirmations enable row level security;
alter table public.cash_corrections enable row level security;
alter table public.anomalies enable row level security;
alter table public.settlements enable row level security;
alter table public.settlement_payments enable row level security;
alter table public.courier_earnings enable row level security;
alter table public.delivery_missions enable row level security;
alter table public.reviews enable row level security;
alter table public.complaints enable row level security;
alter table public.incidents enable row level security;
alter table public.refunds enable row level security;
alter table public.notifications enable row level security;
alter table public.reservations enable row level security;
alter table public.audit_log enable row level security;

-- Référentiels publics
create policy "zones lisibles" on public.zones for select using (active or public.is_admin());
create policy "categories lisibles" on public.categories for select using (active or public.is_admin());

-- Profils
create policy "profil personnel" on public.profiles for select using (id = auth.uid() or public.is_admin());

-- Adresses : le client gère les siennes directement
create policy "adresses perso lecture" on public.addresses for select using (user_id = auth.uid() or public.is_admin());
create policy "adresses perso ajout" on public.addresses for insert with check (user_id = auth.uid());
create policy "adresses perso maj" on public.addresses for update using (user_id = auth.uid());
create policy "adresses perso suppr" on public.addresses for delete using (user_id = auth.uid());

-- Restaurants : publics s'ils sont actifs ; le propriétaire et l'admin voient tout
create policy "restaurants publics" on public.restaurants for select
  using (status = 'active' or owner_id = auth.uid() or public.is_admin());
create policy "historique reglages" on public.restaurant_setting_changes for select
  using (public.owns_restaurant(restaurant_id) or public.is_admin());

create policy "rubriques menu" on public.menu_categories for select
  using (exists (select 1 from public.restaurants r where r.id = restaurant_id and (r.status = 'active' or r.owner_id = auth.uid())) or public.is_admin());
create policy "produits" on public.products for select
  using (exists (select 1 from public.restaurants r where r.id = restaurant_id and (r.status = 'active' or r.owner_id = auth.uid())) or public.is_admin());
create policy "promotions" on public.promotions for select
  using (exists (select 1 from public.restaurants r where r.id = restaurant_id and (r.status = 'active' or r.owner_id = auth.uid())) or public.is_admin());

-- Livreurs
create policy "livreurs" on public.couriers for select
  using (user_id = auth.uid() or (restaurant_id is not null and public.owns_restaurant(restaurant_id)) or public.is_admin());

-- Paramètres : frais publics (le client voit les frais de livraison), réglages admin
create policy "frais lisibles" on public.fee_settings for select using (true);
create policy "reglages lisibles" on public.platform_settings for select using (true);

-- Commandes
create policy "commandes" on public.orders for select using (
  client_id = auth.uid()
  or public.owns_restaurant(restaurant_id)
  or public.courier_sees_order(id)
  or public.is_admin()
);
create policy "lignes commande" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and (
    o.client_id = auth.uid() or public.owns_restaurant(o.restaurant_id)
    or public.courier_sees_order(o.id) or public.is_admin()))
);
create policy "historique statuts" on public.order_status_history for select using (
  exists (select 1 from public.orders o where o.id = order_id and (
    o.client_id = auth.uid() or public.owns_restaurant(o.restaurant_id)
    or public.courier_sees_order(o.id) or public.is_admin()))
);

-- Ventilation : restaurant concerné + administration uniquement (§7.3)
create policy "ventilation" on public.order_financials for select
  using (public.owns_restaurant(restaurant_id) or public.is_admin());

create policy "paiements" on public.payments for select using (
  exists (select 1 from public.orders o where o.id = order_id and (
    o.client_id = auth.uid() or public.owns_restaurant(o.restaurant_id) or public.is_admin()))
);
create policy "encaissements especes" on public.cash_confirmations for select using (
  confirmed_by = auth.uid()
  or exists (select 1 from public.orders o where o.id = order_id and public.owns_restaurant(o.restaurant_id))
  or public.is_admin()
);
create policy "corrections encaissement" on public.cash_corrections for select using (corrected_by = auth.uid() or public.is_admin());
create policy "anomalies" on public.anomalies for select using (
  reported_by = auth.uid()
  or exists (select 1 from public.orders o where o.id = order_id and public.owns_restaurant(o.restaurant_id))
  or public.is_admin()
);
create policy "reversements" on public.settlements for select using (public.owns_restaurant(restaurant_id) or public.is_admin());
create policy "paiements reversements" on public.settlement_payments for select using (
  exists (select 1 from public.settlements s where s.id = settlement_id and public.owns_restaurant(s.restaurant_id)) or public.is_admin()
);
create policy "remunerations livreurs" on public.courier_earnings for select using (
  courier_id in (select public.my_courier_ids())
  or exists (select 1 from public.couriers c where c.id = courier_id and c.restaurant_id is not null and public.owns_restaurant(c.restaurant_id))
  or public.is_admin()
);
create policy "missions" on public.delivery_missions for select using (
  courier_id in (select public.my_courier_ids())
  or exists (select 1 from public.orders o where o.id = order_id and public.owns_restaurant(o.restaurant_id))
  or public.is_admin()
);

create policy "avis publics" on public.reviews for select using (true);
create policy "reclamations" on public.complaints for select using (
  client_id = auth.uid()
  or exists (select 1 from public.orders o where o.id = order_id and public.owns_restaurant(o.restaurant_id))
  or public.is_admin()
);
create policy "incidents" on public.incidents for select using (
  reported_by = auth.uid()
  or exists (select 1 from public.orders o where o.id = order_id and public.owns_restaurant(o.restaurant_id))
  or public.is_admin()
);
create policy "remboursements" on public.refunds for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.client_id = auth.uid() or public.owns_restaurant(o.restaurant_id)))
  or public.is_admin()
);
create policy "notifications perso" on public.notifications for select using (user_id = auth.uid());
create policy "notifications lues" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reservations" on public.reservations for select using (
  client_id = auth.uid() or public.owns_restaurant(restaurant_id) or public.is_admin()
);
create policy "audit" on public.audit_log for select using (public.is_admin());

-- =====================================================================
-- Stockage des images (logos, couvertures, photos de plats)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- =====================================================================
-- Données de référence
-- =====================================================================
insert into public.categories (name, slug, icon, sort) values
  ('Restaurants traditionnels', 'traditionnels', '🍲', 1),
  ('Maquis', 'maquis', '🥘', 2),
  ('Fast-foods', 'fast-foods', '🍔', 3),
  ('Restaurants africains', 'africains', '🌍', 4),
  ('Restaurants européens', 'europeens', '🍝', 5),
  ('Restaurants asiatiques', 'asiatiques', '🍜', 6),
  ('Pizzerias', 'pizzerias', '🍕', 7),
  ('Grillades', 'grillades', '🔥', 8),
  ('Pâtisseries', 'patisseries', '🧁', 9),
  ('Boulangeries', 'boulangeries', '🥖', 10),
  ('Cafés et salons de thé', 'cafes', '☕', 11),
  ('Restaurants d''hôtels', 'hotels', '🏨', 12),
  ('Traiteurs', 'traiteurs', '🍱', 13),
  ('Autres établissements', 'autres', '🍽️', 14);

insert into public.zones (city, name) values
  ('Ouagadougou', 'Ouaga 2000'),
  ('Ouagadougou', 'Koulouba'),
  ('Ouagadougou', 'Zone du Bois'),
  ('Ouagadougou', 'Gounghin'),
  ('Ouagadougou', 'Dapoya'),
  ('Ouagadougou', 'Pissy'),
  ('Ouagadougou', 'Tampouy'),
  ('Ouagadougou', 'Patte d''Oie'),
  ('Ouagadougou', 'Cissin'),
  ('Ouagadougou', 'Wemtenga'),
  ('Bobo-Dioulasso', 'Centre-ville'),
  ('Bobo-Dioulasso', 'Sarfalao'),
  ('Bobo-Dioulasso', 'Accart-Ville'),
  ('Koudougou', 'Centre'),
  ('Ouahigouya', 'Centre');

insert into public.fee_settings (commission_percent, management_fee, delivery_fee, courier_share_percent, note)
values (10, 0, 500, 100, 'Paramétrage initial');

insert into public.platform_settings (key, value) values
  ('cancellation_rules', '"Le client peut annuler tant que le restaurant n''a pas accepté la commande. Après acceptation, l''annulation passe par le service client."'::jsonb),
  ('refund_rules', '"Remboursement intégral si la commande n''est pas livrée ou est refusée après paiement ; remboursement partiel pour une commande incomplète, après examen."'::jsonb),
  ('notification_channels', '{"in_app": true, "sms": false, "email": false}'::jsonb),
  ('remittance_daily_delay_days', '1'::jsonb),
  ('remittance_weekly_delay_days', '3'::jsonb);
