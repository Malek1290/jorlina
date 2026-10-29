-- ============================================================
--  JORLINA — Supabase Setup
--  شغّل الملف ده كامل مرة واحدة من: Supabase Dashboard → SQL Editor
--  بعد تشغيله: كل حاجة جاهزة للـ Frontend (قراءة عامة + كتابة للآدمن فقط)
-- ============================================================

-- 0) الإضافات
create extension if not exists pgcrypto;

-- ============================================================
-- 1) دالة التحقق من الآدمن
--    الـ Frontend بيبعت هيدر:  x-jl-admin: <ADMIN_TOKEN>
--    غيّر الرمز هنا وفي assets/js/config.js لنفس القيمة.
-- ============================================================
create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tok text;
  hdrs json;
begin
  begin
    hdrs := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    hdrs := null;
  end;
  tok := hdrs ->> 'x-jl-admin';
  return tok is not null and tok = 'malik_secure_2026';
end;
$$;

-- ============================================================
-- 2) جدول المنتجات
-- ============================================================
create table if not exists public.items (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  title         text not null,                       -- اسم المنتج (عربي)
  title_en      text,                                -- الاسم بالإنجليزي (اختياري)
  description   text,                                -- الوصف
  price         numeric(10,2) not null default 0,
  old_price     numeric(10,2),                       -- السعر قبل الخصم (اختياري)
  image_url     text not null,                       -- الصورة الرئيسية (Public URL)
  images        text[] not null default '{}',        -- كل الصور (للثامبنيل)
  category      text,
  fabric        text,                                -- الخامة
  sizes         text[] not null default '{}',        -- المقاسات المتاحة
  colors        jsonb  not null default '[]',        -- [{"name":"أسود","hex":"#1A1A1A"}]
  size_guide_url text,                               -- صورة دليل القياسات
  badge         text,                                -- مثل: جديد / آخر قطعة
  is_active     boolean not null default true,
  sort          int not null default 0
);

create index if not exists items_created_idx on public.items (created_at desc);
create index if not exists items_category_idx on public.items (category);

-- الترقيات لو الجدول موجود من قبل بشكل مبسّط
alter table public.items add column if not exists title_en text;
alter table public.items add column if not exists description text;
alter table public.items add column if not exists price numeric(10,2) default 0;
alter table public.items add column if not exists old_price numeric(10,2);
alter table public.items add column if not exists images text[] default '{}';
alter table public.items add column if not exists category text;
alter table public.items add column if not exists fabric text;
alter table public.items add column if not exists sizes text[] default '{}';
alter table public.items add column if not exists colors jsonb default '[]';
alter table public.items add column if not exists size_guide_url text;
alter table public.items add column if not exists badge text;
alter table public.items add column if not exists is_active boolean default true;
alter table public.items add column if not exists sort int default 0;

alter table public.items enable row level security;

drop policy if exists "items_public_read"  on public.items;
drop policy if exists "items_admin_insert" on public.items;
drop policy if exists "items_admin_update" on public.items;
drop policy if exists "items_admin_delete" on public.items;

create policy "items_public_read"  on public.items for select using (true);
create policy "items_admin_insert" on public.items for insert with check (public.is_admin());
create policy "items_admin_update" on public.items for update using (public.is_admin()) with check (public.is_admin());
create policy "items_admin_delete" on public.items for delete using (public.is_admin());

-- ============================================================
-- 3) جدول الطلبات (اختياري — بيحفظ نسخة من كل أوردر)
-- ============================================================
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  code           text unique,                 -- كود الأوردر: JL-...
  customer_name  text not null,
  phone          text not null,
  city           text,
  address        text,
  notes          text,
  payment_method text,
  items          jsonb not null default '[]', -- [{title,size,color,qty,price,image}]
  total          numeric(10,2) not null default 0,
  subtotal       numeric(10,2),
  discount       numeric(10,2) default 0,
  coupon_code    text,
  measurement_urls text[] default '{}',
  status         text not null default 'new'
);

alter table public.orders enable row level security;

drop policy if exists "orders_admin_read" on public.orders;
drop policy if exists "orders_public_insert" on public.orders;
drop policy if exists "orders_admin_update" on public.orders;

-- أي عميل يقدر ينشئ أوردر (زي ما بيشتري)، لكن ما يقدرش يقرأ أوردرات غيره
create policy "orders_public_insert" on public.orders for insert with check (true);
create policy "orders_admin_read"   on public.orders for select using (public.is_admin());
create policy "orders_admin_update" on public.orders for update using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 3.b) عرض لفترة محدودة + الكوبونات
-- ============================================================
-- نهاية العرض المحدود (لو موجود: يظهر عدّاد "ينتهي خلال ..." للعميل)
alter table public.items add column if not exists offer_ends_at timestamptz;
alter table public.items add column if not exists offer_label text;

create table if not exists public.coupons (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  code        text not null unique,
  percent     numeric(5,2) not null check (percent > 0 and percent <= 100),
  product_ids uuid[] not null default '{}',   -- فاضي = ينطبق على كل المنتجات
  active      boolean not null default true,
  starts_at   timestamptz default now(),
  ends_at     timestamptz                     -- null = بدون نهاية
);

alter table public.coupons enable row level security;

drop policy if exists "coupons_admin_all" on public.coupons;
drop policy if exists "coupons_admin_read" on public.coupons;

-- ملاحظة: مفيش قراءة عامة! العميل بيتحقق من الكود عبر دالة validate_coupon
create policy "coupons_admin_read"   on public.coupons for select using (public.is_admin());
create policy "coupons_admin_insert" on public.coupons for insert with check (public.is_admin());
create policy "coupons_admin_update" on public.coupons for update using (public.is_admin()) with check (public.is_admin());
create policy "coupons_admin_delete" on public.coupons for delete using (public.is_admin());

-- دالة التحقق للعميل: بترجّع نسبة الخصم والمنتجات المرتبطة بكود معيّن فقط
-- (عشان قائمة الأكواد كلها تفضل مخفية)
create or replace function public.validate_coupon(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare c public.coupons;
begin
  select * into c
    from public.coupons
   where upper(code) = upper(trim(p_code))
     and active
     and (starts_at is null or starts_at <= now())
     and (ends_at is null or ends_at >= now())
   limit 1;

  if c.id is null then
    return jsonb_build_object('ok', false, 'message', 'Invalid or expired code.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', c.code,
    'percent', c.percent,
    'product_ids', to_jsonb(c.product_ids),
    'ends_at', c.ends_at
  );
end;
$$;

revoke all on function public.validate_coupon(text) from public;
grant execute on function public.validate_coupon(text) to anon, authenticated;

-- ============================================================
-- 4) التخزين (Buckets) + سياسات الوصول
-- ============================================================
insert into storage.buckets (id, name, public)
values
  ('products',     'products',     true),
  ('size-guides',  'size-guides',  true),
  ('measurements', 'measurements', true)
on conflict (id) do update set public = excluded.public;

-- قراءة عامة
drop policy if exists "jl_public_read_objects" on storage.objects;
create policy "jl_public_read_objects" on storage.objects
for select using (bucket_id in ('products','size-guides','measurements'));

-- رفع/تعديل/حذف للآدمن فقط في products و size-guides
drop policy if exists "jl_admin_write_products" on storage.objects;
create policy "jl_admin_write_products" on storage.objects
for insert with check (bucket_id in ('products','size-guides') and public.is_admin());

drop policy if exists "jl_admin_update_products" on storage.objects;
create policy "jl_admin_update_products" on storage.objects
for update using (bucket_id in ('products','size-guides') and public.is_admin());

drop policy if exists "jl_admin_delete_products" on storage.objects;
create policy "jl_admin_delete_products" on storage.objects
for delete using (bucket_id in ('products','size-guides') and public.is_admin());

-- رفع صور المقاسات متاح لأي عميل (bucket خاص بالطلبات)
drop policy if exists "jl_public_insert_measurements" on storage.objects;
create policy "jl_public_insert_measurements" on storage.objects
for insert with check (bucket_id = 'measurements');

-- ============================================================
-- 5) بيانات تجريبية (تتحذف لو الجدول فيه منتجات بالفعل)
--    ملاحظة: صور الديمو موجودة في مجلد assets/img — ارفعها من لوحة
--    الآدمن عشان تاخد روابط Supabase، أو سيبها كصور محلية.
-- ============================================================
insert into public.items (title, title_en, description, price, old_price, image_url, images, category, fabric, sizes, colors, badge, sort)
select * from (values
  ('Celine', 'CELINE',
   'A polished everyday look in a soft oversized hoodie and easy, well-cut trousers.',
   4200::numeric, 4800::numeric, 'assets/img/p1.jpg', array['assets/img/p1.jpg','assets/img/hero.jpg'],
   'Casualwear', 'Soft knit', array['S','M','L','XL'], '[{"name":"أوف وايت","hex":"#EFECE6"}]'::jsonb, 'Bestseller', 1),
  ('Lea', 'LEA',
   'A relaxed oversized hoodie paired with comfortable, neatly tailored trousers.',
   3600::numeric, null, 'assets/img/p2.jpg', array['assets/img/p2.jpg'],
   'Casualwear', 'Soft knit', array['XS','S','M','L','XL'], '[{"name":"زيتوني","hex":"#8A8C7F"}]'::jsonb, 'New', 2),
  ('Noor', 'NOOR',
   'An easy casual outfit in warm neutral tones, designed for comfort throughout the day.',
   2850::numeric, null, 'assets/img/p3.jpg', array['assets/img/p3.jpg'],
   'Casualwear', 'Cotton blend', array['S','M','L'], '[{"name":"بيج رملي","hex":"#D9CDBB"}]'::jsonb, '', 3),
  ('Veronique', 'VERONIQUE',
   'A timeless dark-toned casual set with a roomy top and a clean, flattering silhouette.',
   3900::numeric, 4400::numeric, 'assets/img/p4.jpg', array['assets/img/p4.jpg'],
   'Casualwear', 'Cotton blend', array['S','M','L','XL'], '[{"name":"أسود","hex":"#1A1A1A"}]'::jsonb, 'Limited pieces', 4),
  ('Aria', 'ARIA',
   'A soft ivory hoodie and well-fitting trousers create an effortless, polished everyday look.',
   8600::numeric, null, 'assets/img/p5.jpg', array['assets/img/p5.jpg'],
   'Casualwear', 'Cotton blend', array['XS','S','M','L','مقاس خاص'], '[{"name":"أوف وايت","hex":"#F4F1EA"}]'::jsonb, 'Atelier pick', 5)
) as v(title, title_en, description, price, old_price, image_url, images, category, fabric, sizes, colors, badge, sort)
where not exists (select 1 from public.items);

-- ترقيات لجدول الطلبات لو موجود من قبل
alter table public.orders add column if not exists subtotal numeric(10,2);
alter table public.orders add column if not exists discount numeric(10,2) default 0;
alter table public.orders add column if not exists coupon_code text;

-- كوبون تجريبي (اختياري) — 10% على كل المنتجات، كوده: JORLINA10
insert into public.coupons (code, percent, product_ids, active)
select 'JORLINA10', 10, '{}'::uuid[], true
where not exists (select 1 from public.coupons);

-- ============================================================
-- ✅ خلصنا.  (اختياري) بعد كده: Authentication → Providers → Email → OFF
--    لإغلاق التسجيل ونمنع إنشاء مستخدمين وهميين.
-- ============================================================
