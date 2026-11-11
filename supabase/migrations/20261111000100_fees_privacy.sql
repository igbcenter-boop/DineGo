-- Le taux de commission relève de la ventilation interne (§7.3) : réservé à l'administration.
drop policy if exists "frais lisibles" on public.fee_settings;
create policy "frais admin" on public.fee_settings for select using (public.is_admin());

-- Vue publique : uniquement les frais facturés au client (paramétrage en vigueur)
create or replace view public.public_fees as
  select delivery_fee, management_fee, zone_rules
  from public.fee_settings
  order by created_at desc
  limit 1;
grant select on public.public_fees to anon, authenticated;

-- Circuit de rémunération des livreurs du réseau DineGo quand le restaurant encaisse (§8.3, §25.3)
insert into public.platform_settings (key, value)
values ('network_courier_payment_circuit', '"via_dinego"'::jsonb)
on conflict (key) do nothing;
