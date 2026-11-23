import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { toastFail } from "@/lib/toast-ar";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  author_name: string | null;
  created_at: string;
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "الآن";
  const m = Math.floor(s / 60);
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} س`;
  const d = Math.floor(h / 24);
  return d < 30 ? `قبل ${d} يوم` : `قبل ${Math.floor(d / 30)} شهر`;
}

const Stars = ({ value }: { value: number }) => (
  <span className="text-gold text-sm leading-none" aria-label={`تقييم ${value} من 5`}>
    {"★".repeat(value)}
    <span className="text-muted-foreground/40">{"★".repeat(Math.max(0, 5 - value))}</span>
  </span>
);

export function ShopReviews({ shopId, shopName }: { shopId: string; shopName: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("public_ratings")
      .select("id,rating,comment,author_name,created_at")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false })
      .limit(50);
    setReviews((data ?? []) as unknown as Review[]);
    setLoading(false);
  }, [shopId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    const apply = async (uid: string | null, meta?: Record<string, unknown>) => {
      if (cancelled) return;
      setUserId(uid);
      const name = (meta?.full_name as string) || (meta?.name as string) || "";
      setDisplayName(name);
      if (!uid) return;
      const { data } = await supabase
        .from("ratings")
        .select("rating,comment,author_name")
        .eq("shop_id", shopId)
        .eq("user_id", uid)
        .maybeSingle();
      if (cancelled || !data) return;
      setStars(data.rating ?? 0);
      setComment(data.comment ?? "");
      if (data.author_name) setDisplayName(data.author_name);
    };
    supabase.auth
      .getUser()
      .then(({ data }) =>
        apply(
          data.user?.id ?? null,
          data.user?.user_metadata as Record<string, unknown> | undefined,
        ),
      );
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      apply(
        session?.user?.id ?? null,
        session?.user?.user_metadata as Record<string, unknown> | undefined,
      ),
    );
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [shopId]);

  const submit = async () => {
    if (!userId) return toast.error("سجّل الدخول لكتابة تعليق");
    if (stars < 1) return toast.error("اختر تقييماً بالنجوم أولاً");
    const text = comment.trim();
    if (text.length > 600) return toast.error("التعليق طويل جداً (600 حرف كحد أقصى)");
    setSaving(true);
    const { error } = await supabase.from("ratings").upsert(
      {
        shop_id: shopId,
        user_id: userId,
        rating: stars,
        comment: text || null,
        author_name: displayName.trim() ? displayName.trim().slice(0, 60) : null,
      },
      { onConflict: "shop_id,user_id" },
    );
    setSaving(false);
    if (error) return toastFail(error);
    toast.success("شكراً لك! تم نشر تقييمك");
    load();
  };

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <section className="mt-5 bg-card rounded-2xl border border-border shadow-soft p-5" id="reviews">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-black text-foreground">💬 التعليقات والتقييمات</h2>
        {reviews.length > 0 && (
          <span className="text-xs font-bold text-muted-foreground">
            {avg.toFixed(1)} ★ • {reviews.length} تقييم
          </span>
        )}
      </div>

      {/* Form */}
      <div className="rounded-xl border border-border bg-secondary/40 p-4">
        <p className="text-sm font-black text-foreground mb-2">شاركنا تجربتك مع «{shopName}»</p>
        <div className="flex items-center gap-1 mb-3" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onClick={() => setStars(n)}
              aria-label={`تقييم ${n} من 5`}
              className={`text-2xl leading-none transition-transform hover:scale-110 ${
                n <= (hover || stars) ? "text-gold" : "text-muted-foreground/40"
              }`}
            >
              ★
            </button>
          ))}
          {stars > 0 && (
            <span className="text-xs font-bold text-muted-foreground ms-2">{stars}/5</span>
          )}
        </div>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={60}
          placeholder="اسمك (اختياري)"
          className="w-full mb-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50"
        />
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={600}
          rows={3}
          placeholder="اكتب تعليقك عن الخدمة والجودة والأسعار..."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 resize-y"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-muted-foreground">{comment.length}/600</span>
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-xl px-5 py-2.5 font-black text-sm bg-gold-gradient text-gold-foreground shadow-gold hover:opacity-95 disabled:opacity-60 transition-smooth"
          >
            {saving ? "جارٍ الإرسال..." : "إرسال التعليق"}
          </button>
        </div>
        {!userId && (
          <p className="text-[11px] text-muted-foreground mt-2">
            🔒 سجّل الدخول أولاً لتتمكن من نشر تعليقك.
          </p>
        )}
      </div>

      {/* List */}
      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">جاري تحميل التعليقات...</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            لا توجد تعليقات بعد — كن أول من يشارك تجربته ✨
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {reviews.map((r) => (
              <li key={r.id} className="py-3 flex gap-3 items-start">
                <div className="w-9 h-9 shrink-0 rounded-full bg-gold/20 border border-gold/40 grid place-items-center text-sm font-black text-foreground">
                  {r.author_name?.trim()?.[0] ?? "م"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-foreground">
                      {r.author_name?.trim() || "مستخدم"}
                    </span>
                    <Stars value={r.rating} />
                    <span className="text-[11px] text-muted-foreground">
                      {timeAgo(r.created_at)}
                    </span>
                  </div>
                  {r.comment && (
                    <p className="text-sm text-foreground leading-relaxed mt-1 whitespace-pre-line break-words">
                      {r.comment}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
