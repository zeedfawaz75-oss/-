import { useStorageImage } from "@/hooks/useStorageImage";

interface Props {
  url: string | null | undefined;
  name: string;
  className?: string;
  /** Wrap in a link that opens the full-size image. */
  linkable?: boolean;
}

/** Shop image thumbnail that resolves private-storage URLs before rendering. */
export function ShopThumb({ url, name, className = "", linkable = false }: Props) {
  const src = useStorageImage(url);
  const box = `overflow-hidden bg-secondary ${className}`;

  if (!src) return <div className={`${box} bg-gradient-to-br from-secondary to-muted`} />;

  const img = (
    <img src={src} alt={`صورة ${name}`} loading="lazy" className="w-full h-full object-cover" />
  );
  if (!linkable) return <div className={box}>{img}</div>;

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className={box}
      title="فتح الصورة بالحجم الكامل"
    >
      {img}
    </a>
  );
}
