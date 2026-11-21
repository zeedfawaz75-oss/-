export function HowToUseCard() {
  const steps = [
    { icon: "🔍", title: "ابحث", text: "استخدم شريط البحث للعثور على أي خدمة أو محل." },
    { icon: "🗂️", title: "تصفح", text: "استعرض القطاعات والأقسام الفرعية." },
    { icon: "📞", title: "تواصل", text: "اضغط على زر الاتصال أو الواتساب للوصول السريع." },
  ];
  return (
    <section className="mb-6 bg-card-gradient border border-gold/30 rounded-2xl p-4 sm:p-5 shadow-soft">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">💡</span>
        <h2 className="font-black text-sm sm:text-base text-foreground">
          كيف تستخدم دليل مأرب الخدمي والتجاري الشامل؟
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {steps.map((s) => (
          <div
            key={s.title}
            className="flex items-start gap-2.5 bg-background/60 backdrop-blur rounded-xl p-2.5 border border-border"
          >
            <span className="text-2xl shrink-0">{s.icon}</span>
            <div className="min-w-0">
              <p className="font-black text-xs text-primary mb-0.5">{s.title}</p>
              <p className="text-[11px] text-muted-foreground leading-snug">{s.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
