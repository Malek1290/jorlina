-- ============================================================
--  JORLINA — تحديث 2 : تعديل المنتجات + عرض لفترة محدودة + كوبونات
--  شغّل الملف ده لو كنت عملت setup قبل كده (آمن للتشغيل أكتر من مرة)
--  Supabase Dashboard → SQL Editor → Run
-- ============================================================

create extension if not exists pgcrypto;

-- دالة الإدارة (لو مش موجودة)
create or replace function public.is_admin()
returns boolean language plpgsql stable security definer set search_path = public as $$
declare tok text; hdrs json;
begin
  begin hdrs := nullif(current_setting('request.headers', true), '')::json; exception when others then hdrs := null; end;
  tok := hdrs ->> 'x-jl-admin';
  return tok is not null and tok = 'malik_secure_2026';
end; $$;

-- 1) عرض لفترة محدودة
alter table public.items add column if not exists offer_ends_at timestamptz;
alter table public.items add column if not exists offer_label   text;

-- 2) الكوبونات
create table if not exists public.coupons (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  code        text not null unique,
  percent     numeric(5,2) not null check (percent > 0 and percent <= 100),
  product_ids uuid[] not null default '{}',
  active      boolean not null default true,
  starts_at   timestamptz default now(),
  ends_at     timestamptz
);

alter table public.coupons enable row level security;
drop policy if exists "coupons_admin_read"   on public.coupons;
drop policy if exists "coupons_admin_insert" on public.coupons;
drop policy if exists "coupons_admin_update" on public.coupons;
drop policy if exists "coupons_admin_delete" on public.coupons;
create policy "coupons_admin_read"   on public.coupons for select using (public.is_admin());
create policy "coupons_admin_insert" on public.coupons for insert with check (public.is_admin());
create policy "coupons_admin_update" on public.coupons for update using (public.is_admin()) with check (public.is_admin());
create policy "coupons_admin_delete" on public.coupons for delete using (public.is_admin());

create or replace function public.validate_coupon(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c public.coupons;
begin
  select * into c from public.coupons
   where upper(code) = upper(trim(p_code)) and active
     and (starts_at is null or starts_at <= now())
     and (ends_at is null or ends_at >= now())
   limit 1;
  if c.id is null then
    return jsonb_build_object('ok', false, 'message', 'Invalid or expired code.');
  end if;
  return jsonb_build_object('ok', true, 'code', c.code, 'percent', c.percent,
                            'product_ids', to_jsonb(c.product_ids), 'ends_at', c.ends_at);
end; $$;

revoke all on function public.validate_coupon(text) from public;
grant execute on function public.validate_coupon(text) to anon, authenticated;

-- 3) حقول الخصم في الطلبات
alter table public.orders add column if not exists subtotal numeric(10,2);
alter table public.orders add column if not exists discount numeric(10,2) default 0;
alter table public.orders add column if not exists coupon_code text;

-- ============================================================
-- 4) تشديد الحماية (مهم!)
--    اكتشفنا إن الكتابة على items كانت متاحة لأي زائر (RLS مش مفعّل).
--    القسم ده بيقفلها: القراءة عامة / الكتابة للآدمن فقط.
-- ============================================================
alter table public.items enable row level security;

drop policy if exists "items_public_read"     on public.items;
drop policy if exists "items_admin_insert"    on public.items;
drop policy if exists "items_admin_update"    on public.items;
drop policy if exists "items_admin_delete"    on public.items;
drop policy if exists "Enable read access for all users" on public.items;
drop policy if exists "Enable insert for authenticated users only" on public.items;
drop policy if exists "Enable update for authenticated users only" on public.items;
drop policy if exists "Public read" on public.items;
drop policy if exists "public_all" on public.items;
drop policy if exists "allow_all" on public.items;

create policy "items_public_read"  on public.items for select using (true);
create policy "items_admin_insert" on public.items for insert with check (public.is_admin());
create policy "items_admin_update" on public.items for update using (public.is_admin()) with check (public.is_admin());
create policy "items_admin_delete" on public.items for delete using (public.is_admin());

-- الطلبات: إنشاء متاح للعميل، القراءة/التعديل للآدمن
alter table public.orders enable row level security;
drop policy if exists "orders_public_insert" on public.orders;
drop policy if exists "orders_admin_read"    on public.orders;
drop policy if exists "orders_admin_update"  on public.orders;
create policy "orders_public_insert" on public.orders for insert with check (true);
create policy "orders_admin_read"    on public.orders for select using (public.is_admin());
create policy "orders_admin_update"  on public.orders for update using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 5) التخزين (Buckets) + سياساتها
-- ============================================================
insert into storage.buckets (id, name, public)
values ('products','products',true), ('size-guides','size-guides',true), ('measurements','measurements',true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "jl_public_read_objects" on storage.objects;
create policy "jl_public_read_objects" on storage.objects
for select using (bucket_id in ('products','size-guides','measurements'));

drop policy if exists "jl_admin_write_products" on storage.objects;
create policy "jl_admin_write_products" on storage.objects
for insert with check (bucket_id in ('products','size-guides') and public.is_admin());

drop policy if exists "jl_admin_update_products" on storage.objects;
create policy "jl_admin_update_products" on storage.objects
for update using (bucket_id in ('products','size-guides') and public.is_admin());

drop policy if exists "jl_admin_delete_products" on storage.objects;
create policy "jl_admin_delete_products" on storage.objects
for delete using (bucket_id in ('products','size-guides') and public.is_admin());

drop policy if exists "jl_public_insert_measurements" on storage.objects;
create policy "jl_public_insert_measurements" on storage.objects
for insert with check (bucket_id = 'measurements');

-- 6) كوبون تجريبي
insert into public.coupons (code, percent, product_ids, active)
select 'JORLINA10', 10, '{}'::uuid[], true
where not exists (select 1 from public.coupons);

-- ✅ تم
