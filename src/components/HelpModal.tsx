import { ModalCloseButton } from "@/components/ModalCloseButton";

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
          <div className="text-3xl mb-1">❓</div>
          <h3 className="font-black text-base">مركز المساعدة</h3>
        </div>

        <div className="p-5 overflow-y-auto overscroll-contain flex-1 min-h-0">
          <p className="text-sm text-muted-foreground mb-4">
            دليل مأرب يجمع المحلات التجارية والخدمات في مكان واحد. اتبع الخطوات التالية للاستفادة
            القصوى:
          </p>

          <div className="space-y-3">
            {howSteps.map((step, i) => (
              <div
                key={i}
                className="flex items-start gap-3 bg-secondary/40 rounded-xl p-3 border border-border"
              >
                <span className="text-2xl shrink-0">{step.icon}</span>
                <div>
                  <p className="font-bold text-xs text-foreground mb-0.5">{step.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-border bg-secondary/20 shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-gold-gradient text-gold-foreground rounded-xl py-2.5 font-bold hover:opacity-90 active:scale-95 transition-smooth"
          >
            فهمت / إغلاق ✓
          </button>
        </div>
      </div>
    </div>
  );
}
