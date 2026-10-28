/* ============================================================
   CLOTHINA — CONFIG  (ملف الإعدادات الوحيد اللي تعدّل فيه)
   ============================================================
   ملاحظة أمنية مهمة:
   الـ Public / Publishable key من Supabase آمن إنه يظهر في الـ Frontend
   (ده الغرض منه)، لأنه محكوم بـ Row Level Security.
   اللي مش آمن أبداً هو الـ service_role key — متحطهوش هنا.
   الحماية الحقيقية للآدمن معمولة على 3 طبقات:
     1) ADMIN_TOKEN في الرابط → localStorage (إخفاء الواجهة).
     2) دالة is_admin() في قاعدة البيانات بتتحقق من نفس الرمز قبل أي كتابة.
     3) RLS على الجداول والـ Storage: القراءة عامة، الكتابة للآدمن فقط.
   ============================================================ */

window.JL_CONFIG = {
  /* -------- Supabase -------- */
  SUPABASE_URL: "https://ymsrfxmwwpwjgzzaytsh.supabase.co",
  SUPABASE_KEY: "sb_publishable_7F9pDlnAtMvMOilzmkBXCw_G3CsiFr5",

  /* -------- الأسرار (لا تشاركها) -------- */
  ADMIN_TOKEN: "malik_secure_2026",      // الرابط السري:  index.html?admin=malik_secure_2026
  ADMIN_STORAGE_KEY: "jl_admin_v1",      // مفتاح حفظ حالة الآدمن في المتصفح

  /* -------- التخزين في Supabase Storage -------- */
  BUCKET_PRODUCTS: "products",           // صور المنتجات
  BUCKET_SIZES: "size-guides",           // صور دليل القياسات
  BUCKET_MEASUREMENTS: "measurements",   // صور مقاسات العملاء (ترفع مع الطلب)

  /* -------- جدول قاعدة البيانات -------- */
  TABLE_ITEMS: "items",
  TABLE_ORDERS: "orders",
  TABLE_COUPONS: "coupons",           // كوبونات/خصومات (شغّل supabase-update-2.sql)

  /* -------- الهوية والتواصل -------- */
  CITY: "القاهرة، مصر",
  INSTAGRAM: "",
  TIKTOK: "https://www.tiktok.com/@clothinaa__0",
  INSTAGRAM_HANDLE: "",
  TIKTOK_HANDLE: "@clothinaa__0",

  /* دفعة مقدمة عبر فودافون كاش كنسبة من إجمالي الطلب */
  DEPOSIT_PERCENT: 50,
  VODAFONE_CASH_NUMBER: "01040124131",

  /* -------- المتجر -------- */
  WHATSAPP_NUMBER: "201040124131",       // واتساب مصر: 01040124131
  CURRENCY: "ج.م",                        // الجنيه المصري
  SHIPPING: 0,                            // مصاريف شحن ثابتة (0 = مجاني)
  FREE_SHIPPING_NOTE: "توصيل لجميع محافظات مصر",

  /* الاختيارات الافتراضية (تظهر للعميل في صفحة المنتج) */
  DEFAULT_SIZES: ["XS", "S", "M", "L", "XL", "XXL", "مقاس خاص"],
  DEFAULT_COLORS: [
    { name: "أوف وايت", hex: "#EFECE6" },
    { name: "بيج رملي", hex: "#D9CDBB" },
    { name: "زيتوني", hex: "#8A8C7F" },
    { name: "أسود", hex: "#1A1A1A" }
  ],
  CATEGORIES: ["فساتين سهرة", "فساتين زفاف", "فساتين كاجوال", "عبايات", "إطلالات"],
  PAYMENT_METHODS: [
    {
      id: "vodafone_cash",
      title: "فودافون كاش",
      sub: "دفعة مقدمة ٥٠٪ من إجمالي الطلب",
      logo: "VC",
      depositPercent: 50,
      note: "حوّلي ٥٠٪ من إجمالي الطلب على فودافون كاش لتأكيد الأوردر. يتم دفع المبلغ المتبقي عند الاستلام."
    }
  ]
};
