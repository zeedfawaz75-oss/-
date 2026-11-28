import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  CircleHelp,
  Copy,
  FileText,
  Headset,
  MessageCircle,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { ModalCloseButton } from "@/components/ModalCloseButton";
import { getLegalPage } from "@/lib/legal.functions";
import { LEGAL_PAGE_TITLES, type LegalPageSlug } from "@/lib/legal-content";
import { APP_SHARE_TEXT, APP_URL } from "@/lib/share";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_WHATSAPP } from "@/lib/support";
import { toast } from "sonner";
import { refreshAppAndClearCache } from "@/lib/pwa";

type HelpSubpage = "guide" | "faq" | "contact" | LegalPageSlug;

const SUPPORT_MESSAGE = "مرحباً، أود التواصل مع إدارة دليل مأرب التجاري الخدمي الشامل.";

const helpOptions = [
  { id: "guide", title: "كيفية استخدام الدليل", Icon: BookOpen },
  { id: "terms", title: LEGAL_PAGE_TITLES.terms, Icon: FileText },
  { id: "privacy", title: LEGAL_PAGE_TITLES.privacy, Icon: ShieldCheck },
  { id: "faq", title: "الأسئلة الشائعة", Icon: CircleHelp },
  { id: "contact", title: "تواصل مع الإدارة", Icon: Headset },
] as const;

const faqItems = [
  {
    question: "هل إضافة المحل إلى الدليل مجانية؟",
    answer:
      "نعم، إضافة المحل وإرسال طلب الإدراج الأساسي مجانيان. أي خدمات ترويجية اختيارية لا تُعد شرطاً لإضافة المحل.",
  },
  {
    question: "كم تستغرق مراجعة طلب إضافة المحل؟",
    answer:
      "لا توجد مدة ثابتة للمراجعة؛ فهي تعتمد على اكتمال البيانات وعدد الطلبات. تأكد من صحة رقم التواصل والتصنيف والعنوان لتسهيل المراجعة.",
  },
  {
    question: "متى يظهر المحل في الدليل؟",
    answer:
      "يظهر المحل بعد مراجعة الإدارة واعتماد الطلب. ستصلك حالة الطلب عبر حسابك أو الإشعارات المتاحة في التطبيق.",
  },
  {
    question: "كيف أعدّل بيانات المحل بعد إرساله؟",
    answer:
      "تواصل مع الإدارة واذكر اسم المحل والبيانات التي تريد تصحيحها أو تحديثها. لا ترسل طلباً مكرراً للمحل نفسه.",
  },
];

const howSteps = [
  {
    icon: "🔍",
    title: "ابحث بسرعة",
    text: "استخدم شريط البحث في أعلى الصفحة للعثور على أي خدمة أو محل تجاري بكتابة اسمه أو نشاطه.",
  },
  {
    icon: "🗂️",
    title: "تصفّح القطاعات",
    text: "استعرض الأقسام الرئيسية (طوارئ، مطاعم، سيارات، خدمات…) واختر القسم الفرعي المناسب.",
  },
  {
    icon: "📞",
    title: "تواصل مباشرة",
    text: "اضغط على زر الاتصال أو الواتساب أو الموقع للوصول إلى صاحب المحل فوراً.",
  },
  {
    icon: "❤",
    title: "المفضلة",
    text: "اضغط على أيقونة القلب بجانب أي محل لحفظه في قائمة «محلاتي المفضلة» للوصول السريع.",
  },
  {
    icon: "➕",
    title: "أضف محلك",
    text: "سجّل الدخول، ثم اضغط «أضف محلك» واملأ البيانات. سيتم مراجعة طلبك قبل النشر.",
  },
  {
    icon: "⭐",
    title: "قيّم وعلّق",
    text: "ساهم بتقييم المحلات وكتابة تعليقاتك لتساعد الآخرين على اختيار الخدمة الأفضل.",
  },
];

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [subpage, setSubpage] = useState<HelpSubpage | null>(null);
  const [legalPage, setLegalPage] = useState<{ title: string; content: string } | null>(null);
  const [legalLoading, setLegalLoading] = useState(false);
  const [legalError, setLegalError] = useState("");
  const [refreshingApp, setRefreshingApp] = useState(false);
  const legalRequestId = useRef(0);
  const getLegalPageFn = useServerFn(getLegalPage);

  useEffect(() => {
    if (open) return;
    legalRequestId.current += 1;
    setSubpage(null);
    setLegalPage(null);
    setLegalLoading(false);
    setLegalError("");
  }, [open]);

  const openLegalPage = async (slug: LegalPageSlug) => {
    const requestId = ++legalRequestId.current;
    setSubpage(slug);
    setLegalPage(null);
    setLegalError("");
    setLegalLoading(true);

    try {
      const page = await getLegalPageFn({ data: { slug } });
      if (requestId === legalRequestId.current) setLegalPage(page);
    } catch (error) {
      if (requestId === legalRequestId.current) {
        setLegalError(error instanceof Error ? error.message : "تعذّر تحميل النص القانوني.");
      }
    } finally {
      if (requestId === legalRequestId.current) setLegalLoading(false);
    }
  };

  const copyAppLink = async () => {
    if (!navigator.clipboard?.writeText) {
      toast.error("تعذّر نسخ الرابط من هذا المتصفح.");
      return;
    }

    try {
      await navigator.clipboard.writeText(APP_URL);
      toast.success("تم نسخ الرابط");
    } catch {
      toast.error("تعذّر نسخ الرابط. تحقق من أذونات المتصفح وحاول مجدداً.");
    }
  };

  const refreshApp = async () => {
    setRefreshingApp(true);
    try {
      await refreshAppAndClearCache();
      window.location.reload();
    } catch (error) {
      setRefreshingApp(false);
      toast.error(error instanceof Error ? error.message : "تعذّر تحديث التطبيق.");
    }
  };

  const returnToHelpCenter = () => {
    legalRequestId.current += 1;
    setSubpage(null);
    setLegalPage(null);
    setLegalLoading(false);
    setLegalError("");
  };

  const renderBackButton = () => (
    <button
      type="button"
      onClick={returnToHelpCenter}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-bold text-primary transition-smooth hover:bg-primary/15"
    >
      <ArrowRight size={18} />
      رجوع إلى مركز المساعدة
    </button>
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[130] grid place-items-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto overscroll-contain"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card text-foreground rounded-2xl shadow-elegant overflow-hidden animate-fade-in-up max-h-[92dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="bg-hero text-primary-foreground p-4 text-center relative shrink-0">
          <div className="absolute top-2 left-2">
            <ModalCloseButton onClose={onClose} />
          </div>
          <div className="text-3xl mb-1">
            {subpage === "guide" ? (
              <BookOpen className="mx-auto" size={30} />
            ) : subpage === "faq" ? (
              <CircleHelp className="mx-auto" size={30} />
            ) : subpage === "contact" ? (
              <Headset className="mx-auto" size={30} />
            ) : subpage === "privacy" ? (
              <ShieldCheck className="mx-auto" size={30} />
            ) : subpage ? (
              <FileText className="mx-auto" size={30} />
            ) : (
              "❓"
            )}
          </div>
          <h3 className="font-black text-base">
            {subpage === "guide"
              ? "كيفية استخدام الدليل"
              : subpage === "faq"
                ? "الأسئلة الشائعة"
                : subpage === "contact"
                  ? "تواصل مع الإدارة"
                  : subpage
                    ? (legalPage?.title ?? LEGAL_PAGE_TITLES[subpage])
                    : "مركز المساعدة"}
          </h3>
        </div>

        <div className="p-5 overflow-y-auto overscroll-contain flex-1 min-h-0">
          {subpage ? (
            <div className="space-y-4">
              {renderBackButton()}

              {subpage === "guide" ? (
                <div className="space-y-3">
                  {howSteps.map((step, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-xl border border-border bg-secondary/40 p-3"
                    >
                      <span className="shrink-0 text-2xl">{step.icon}</span>
                      <div>
                        <p className="mb-0.5 text-xs font-bold text-foreground">{step.title}</p>
                        <p className="text-[11px] leading-snug text-muted-foreground">
                          {step.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : subpage === "faq" ? (
                <div className="space-y-3">
                  {faqItems.map(({ question, answer }) => (
                    <section
                      key={question}
                      className="rounded-xl border border-border bg-secondary/40 p-3"
                    >
                      <h4 className="mb-1 text-sm font-bold text-foreground">{question}</h4>
                      <p className="text-xs leading-relaxed text-muted-foreground">{answer}</p>
                    </section>
                  ))}
                </div>
              ) : subpage === "contact" ? (
                <div className="space-y-3">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    يسعد إدارة الدليل استقبال استفساراتك وملاحظاتك.
                  </p>
                  <a
                    href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(SUPPORT_MESSAGE)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#25D366]/30 bg-[#25D366] p-3 text-white transition-smooth hover:brightness-95"
                  >
                    <span className="flex items-center gap-3">
                      <MessageCircle size={20} />
                      <span className="text-sm font-bold">تواصل عبر واتساب الإدارة</span>
                    </span>
                    <ChevronLeft size={18} />
                  </a>
                  <a
                    href={`tel:+${SUPPORT_WHATSAPP}`}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-3 text-right transition-smooth hover:bg-secondary/70"
                  >
                    <span className="flex items-center gap-3">
                      <PhoneCall className="text-primary" size={20} />
                      <span className="text-sm font-bold text-foreground">اتصال بالإدارة</span>
                    </span>
                    <ChevronLeft className="text-muted-foreground" size={18} />
                  </a>
                  <p className="text-center text-xs text-muted-foreground" dir="ltr">
                    {SUPPORT_PHONE_DISPLAY}
                  </p>
                </div>
              ) : (
                <>
                  {legalLoading && (
                    <p className="py-8 text-center text-sm text-muted-foreground" role="status">
                      جارٍ تحميل النص…
                    </p>
                  )}
                  {legalError && (
                    <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center">
                      <p className="text-sm text-destructive">{legalError}</p>
                      <button
                        type="button"
                        onClick={() => openLegalPage(subpage)}
                        className="rounded-lg bg-secondary px-4 py-2 text-xs font-bold text-foreground hover:bg-secondary/80"
                      >
                        إعادة المحاولة
                      </button>
                    </div>
                  )}
                  {legalPage && (
                    <article
                      dir="rtl"
                      className="rounded-xl border border-border bg-secondary/20 p-4 text-sm leading-7 text-foreground whitespace-pre-line"
                    >
                      {legalPage.content}
                    </article>
                  )}
                </>
              )}

              {renderBackButton()}
            </div>
          ) : (
            <div className="space-y-3">
              {helpOptions.map(({ id, title, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    if (id === "terms" || id === "privacy") {
                      void openLegalPage(id);
                    } else {
                      setSubpage(id);
                    }
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-3 text-right transition-smooth hover:bg-secondary/70 active:scale-[0.99]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Icon className="shrink-0 text-primary" size={20} />
                    <span className="text-sm font-bold text-foreground">{title}</span>
                  </span>
                  <ChevronLeft className="shrink-0 text-muted-foreground" size={18} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border bg-secondary/20 shrink-0">
          {!subpage && (
            <div className="mb-3 grid grid-cols-3 gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(APP_SHARE_TEXT)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg border border-[#25D366]/30 bg-[#25D366] px-2 py-2 text-[11px] font-bold text-white transition-smooth hover:brightness-95"
              >
                <MessageCircle size={15} />
                <span>مشاركة الدليل عبر واتساب</span>
              </a>
              <button
                type="button"
                onClick={copyAppLink}
                className="flex items-center justify-center gap-1 rounded-lg border border-border bg-secondary/60 px-1.5 py-2 text-[10px] font-bold text-foreground transition-smooth hover:bg-secondary"
              >
                <Copy size={15} />
                <span>نسخ رابط التطبيق</span>
              </button>
              <button
                type="button"
                onClick={refreshApp}
                disabled={refreshingApp}
                aria-live="polite"
                className="flex items-center justify-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-1.5 py-2 text-[10px] font-bold text-primary transition-smooth hover:bg-primary/15 disabled:opacity-60"
              >
                <RefreshCw size={14} className={refreshingApp ? "animate-spin" : ""} />
                <span>{refreshingApp ? "جارٍ التحديث…" : "تحديث التطبيق"}</span>
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-gold-gradient text-gold-foreground rounded-xl py-2.5 font-bold hover:opacity-90 active:scale-95 transition-smooth"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
