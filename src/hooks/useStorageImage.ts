import { useEffect, useState } from "react";
import { resolveStorageUrl } from "@/lib/storage-url";

/** Returns a displayable (signed) URL for an image stored in Cloud storage. */
export function useStorageImage(url: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!url) {
      setSrc(null);
      return;
    }
    resolveStorageUrl(url).then((u) => {
      if (alive) setSrc(u);
    });
    return () => {
      alive = false;
    };
  }, [url]);

  return src;
}
