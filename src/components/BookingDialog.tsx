import { ModalCloseButton } from "@/components/ModalCloseButton";
import { useState } from "react";
import type { Shop } from "@/lib/shops";

interface Props {
  shop: Shop;
  open: boolean;
  onClose: () => void;
}

export function BookingDialog({ shop, open, onClose }: Props) {
  const [customerName, setCustomerName] = useState("");
  const [datetime, setDatetime] = useState("");
  const [details, setDetails] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!customerName.trim() || !datetime.trim() || !details.trim() || !customerPhone.trim()) {
      return setError("يرجى تعبئة جميع الحقول.");
    }

    const msg =
      `🗓️ طلب حجز / خدمة جديد عبر دليل مأرب الشامل\n\n` +
      `🏪 المحل: ${shop.name}\n` +
      `——————————————\n` +
      `👤 الاسم: ${customerName.trim()}\n` +
      `📞 رقم التواصل: ${customerPhone.trim()}\n` +
      `🕒 الموعد المطلوب: ${datetime.trim()}\n` +
      `📝 التفاصيل: ${details.trim()}\n\n` +
      `يرجى تأكيد الموعد. شكراً لكم.`;

    const wa = (shop.whatsapp || shop.phone).replace(/\D/g, "");
    const url = `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto overscroll-contain"
      onClick={onClose}
    >
      <div
        className="bg-card w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto overscroll-contain shadow-elegant relative z-[1]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-hero text-primary-foreground p-4 flex items-center justify-between">
          <h2 className="font-black text-base">🗓️ احجز موعداً — {shop.name}</h2>
          <ModalCloseButton onClose={onClose} />
        </div>

        <form onSubmit={submit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">اسمك *</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              maxLength={80}
              required
              className="w-full bg-background border border-border rounded-xl p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">
              رقم هاتفك *
            </label>
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              dir="ltr"
              required
              className="w-full bg-background border border-border rounded-xl p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">
              التاريخ / الوقت *
            </label>
            <input
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              placeholder="مثال: غداً الساعة 5 عصراً"
              required
              className="w-full bg-background border border-border rounded-xl p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">
              تفاصيل الطلب / الحجز *
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={500}
              required
              className="w-full bg-background border border-border rounded-xl p-2 text-sm"
            />
          </div>

          {error && (
            <div className="bg-emergency/10 border border-emergency/30 text-emergency text-sm rounded-xl p-3">
              {error}
            </div>
          )}

          <div className="bg-secondary/50 border border-border rounded-xl p-3 text-[11px] text-muted-foreground">
            ℹ️ سيتم فتح واتساب بنص الرسالة جاهز — تأكد من إرسالها لصاحب المحل.
          </div>

          <button
            type="submit"
            className="w-full bg-gold-gradient text-gold-foreground rounded-xl py-3 font-bold shadow-gold inline-flex items-center justify-center gap-2"
          >
            💬 إرسال الطلب عبر واتساب
          </button>
        </form>
      </div>
    </div>
  );
}
