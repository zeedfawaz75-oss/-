import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastFail } from "@/lib/toast-ar";
import { adminBroadcast } from "@/lib/admin.functions";

export function BroadcastPanel() {
  const send = useServerFn(adminBroadcast);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (title.trim().length < 2) {
      toast.error("اكتب عنوان الإشعار");
      return;
    }
    setSending(true);
    try {
      const res = await send({ data: { title: title.trim(), body: body.trim() || null } });
      toast.success(`تم إرسال الإشعار إلى ${res.sent} مستخدم 🔔`);
      setTitle("");
      setBody("");
    } catch (e) {
      toastFail(e, "تعذّر الإرسال");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-soft space-y-3 max-w-lg">
      <div>
        <h3 className="font-black">📣 إرسال إشعار لجميع المستخدمين</h3>
        <p className="text-xs text-muted-foreground mt-1">
          يصل الإشعار فوراً إلى جرس الإشعارات لدى كل مستخدم مسجّل.
        </p>
      </div>
      <label className="block text-xs font-bold">
        عنوان الإشعار
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="مثال: تحديث جديد في دليل مأرب"
          className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-normal"
        />
      </label>
      <label className="block text-xs font-bold">
        نص الإشعار (اختياري)
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="اكتب تفاصيل التنبيه هنا..."
          className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-normal"
        />
      </label>
      <button
        onClick={submit}
        disabled={sending}
        className="w-full bg-gold-gradient text-gold-foreground rounded-xl py-2.5 font-bold text-sm disabled:opacity-50"
      >
        {sending ? "جارِ الإرسال..." : "🚀 إرسال الآن"}
      </button>
    </div>
  );
}
