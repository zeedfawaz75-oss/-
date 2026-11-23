import { ShopCard } from "./ShopCard";
import type { Shop } from "@/lib/shops";

interface Props {
  shops: Shop[];
  emptyLabel?: string;
  compact?: boolean;
}

/**
 * Reusable responsive grid of shop cards — "Rasina" layout.
 * 1 col mobile → 2 col tablet → 3 col desktop, consistent spacing.
 */
export function ShopGrid({ shops, emptyLabel, compact }: Props) {
  if (shops.length === 0) {
    return emptyLabel ? (
      <div className="bg-card rounded-2xl p-6 text-center border border-border text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    ) : null;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {shops.map((s) => (
        <ShopCard key={s.id} shop={s} compact={compact} />
      ))}
    </div>
  );
}
