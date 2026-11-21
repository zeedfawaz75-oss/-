/**
 * Unified modal close button (X).
 * Always type="button", stops pointer/click bubbling so overlay handlers or
 * parent forms can never swallow the tap, and has a large touch target.
 */
export function ModalCloseButton({
  onClose,
  className = "",
  label = "إغلاق",
}: {
  onClose: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      className={`relative z-[5] shrink-0 w-9 h-9 grid place-items-center rounded-full bg-black/10 hover:bg-black/20 active:scale-95 transition-smooth text-xl leading-none cursor-pointer ${className}`}
    >
      ✕
    </button>
  );
}
