import { useEffect, useState } from "react";

type Status = "idle" | "sending" | "success" | "error";

interface Props {
  /** Seconds to wait between resends */
  cooldown?: number;
  /** Called when the user clicks resend */
  onResend: () => void | Promise<void>;
  /** Optional label override */
  label?: string;
}

const STATUS_MAP: Record<Status, { text: string; color: string; icon: string }> = {
  idle: { text: "إعادة إرسال OTP", color: "", icon: "🔁" },
  sending: { text: "جارٍ إرسال الرمز…", color: "text-primary", icon: "⏳" },
  success: { text: "تم إرسال الرمز بنجاح ✅", color: "text-green-600", icon: "✅" },
  error: { text: "فشل الإرسال — اضغط لإعادة المحاولة", color: "text-emergency", icon: "❌" },
};

/**
 * Reusable resend button with a breathing countdown timer.
 * Prevents users from spamming OTP requests.
 */
export function OtpResend({ cooldown = 60, onResend, label = "إعادة إرسال OTP" }: Props) {
  const [remaining, setRemaining] = useState<number>(cooldown);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [remaining]);

  // Clear success/error after 3s so the button returns to normal
  useEffect(() => {
    if (status === "idle" || status === "sending") return;
    const t = setTimeout(() => setStatus("idle"), 3000);
    return () => clearTimeout(t);
  }, [status]);

  const disabled = remaining > 0 || busy;
  const progress = ((cooldown - remaining) / cooldown) * 100;

  const handleClick = async () => {
    if (disabled) return;
    setBusy(true);
    setStatus("sending");
    try {
      await onResend();
      setRemaining(cooldown);
      setStatus("success");
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  };

  const isPostAction = status === "success" || status === "error";
  const current = isPostAction ? STATUS_MAP[status] : { text: busy ? "جارٍ الإرسال…" : label, color: "", icon: "🔁" };

  return (
    <div className="w-full space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled && !isPostAction}
        className={`relative overflow-hidden w-full rounded-xl py-2.5 px-4 text-sm font-bold border transition-smooth ${
          disabled && !isPostAction
            ? "bg-secondary border-border text-muted-foreground cursor-not-allowed"
            : status === "error"
            ? "bg-emergency/10 border-emergency text-emergency hover:bg-emergency/20"
            : status === "success"
            ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
            : "bg-primary text-primary-foreground border-transparent hover:opacity-90"
        }`}
      >
        {/* Breathing progress fill */}
        {remaining > 0 && !isPostAction && (
          <span
            aria-hidden
            className="absolute inset-y-0 right-0 bg-primary/20 transition-all duration-1000 ease-linear"
            style={{ width: `${100 - progress}%` }}
          />
        )}
        <span className="relative inline-flex items-center justify-center gap-2">
          <span className={remaining > 0 && !isPostAction ? "animate-pulse" : ""}>{current.icon}</span>
          {remaining > 0 && !isPostAction ? (
            <>
              <span>يمكنك إعادة الإرسال خلال</span>
              <span className="font-black tabular-nums">{remaining}</span>
              <span>ث</span>
            </>
          ) : (
            <span className={current.color}>{current.text}</span>
          )}
        </span>
      </button>

      {/* Inline helper text for error / success */}
      {status === "error" && (
        <p className="text-xs text-center text-emergency">
          حدث خطأ أثناء الإرسال، تحقق من اتصالك ثم اضغط الزر مرة أخرى.
        </p>
      )}
    </div>
  );
}
