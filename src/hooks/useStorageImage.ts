import { useEffect, useState } from "react";
import { resolveStorageUrl, type StorageImageTransform } from "@/lib/storage-url";

export const SHOP_THUMBNAIL_TRANSFORM: StorageImageTransform = { width: 640, quality: 65 };

/** Returns a displayable (signed) URL for an image stored in Cloud storage. */
export function useStorageImage(
  url: string | null | undefined,
  transform?: StorageImageTransform,
): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!url) {
      setSrc(null);
      return;
    }
    setSrc(null);
    resolveStorageUrl(url, transform).then((u) => {
      if (alive) setSrc(u);
    });
    return () => {
      alive = false;
    };
  }, [url, transform]);

  return src;
}
