import { supabase } from "@/integrations/supabase/client";

/**
 * Store images live in a private bucket, so raw "public" URLs return 404.
 * These helpers turn any stored URL into a working (signed) URL, with caching.
 */
const SIGN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const memo = new Map<string, Promise<string>>();

export interface StorageImageTransform {
  width: number;
  quality?: number;
}

export function parseStoragePath(url: string): { bucket: string; path: string } | null {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/?#]+)\/([^?#]+)/);
  if (!m) return null;
  return { bucket: m[1]!, path: decodeURIComponent(m[2]!) };
}

export async function resolveStorageUrl(
  url: string | null | undefined,
  transform?: StorageImageTransform,
): Promise<string | null> {
  if (!url) return null;
  const parsed = parseStoragePath(url);
  if (!parsed) return url;
  const transformKey = transform ? JSON.stringify(transform) : "original";
  const key = `${parsed.bucket}/${parsed.path}:${transformKey}`;
  const cached = memo.get(key);
  if (cached) return cached;
  const p = (async () => {
    const storage = supabase.storage.from(parsed.bucket);
    const { data } = await storage.createSignedUrl(
      parsed.path,
      SIGN_TTL_SECONDS,
      transform ? { transform } : undefined,
    );
    if (data?.signedUrl) return data.signedUrl;

    if (transform) {
      const { data: originalData } = await storage.createSignedUrl(parsed.path, SIGN_TTL_SECONDS);
      if (originalData?.signedUrl) return originalData.signedUrl;
    }

    return url;
  })();
  memo.set(key, p);
  return p;
}
