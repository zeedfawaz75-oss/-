import { useCallback, useEffect, useState } from "react";

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLS<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch { /* ignore */ }
}

const FAV_KEY = "marib:favorites";
const RATE_KEY = "marib:ratings";
const THEME_KEY = "marib:theme";

export function useFavorites() {
  const [favs, setFavs] = useState<Record<string, true>>(() => readLS(FAV_KEY, {}));
  useEffect(() => writeLS(FAV_KEY, favs), [favs]);
  const toggle = useCallback((id: string) => {
    setFavs((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id]; else next[id] = true;
      return next;
    });
  }, []);
  const isFav = useCallback((id: string) => !!favs[id], [favs]);
  return { favs, toggle, isFav };
}

export function useRatings() {
  const [ratings, setRatings] = useState<Record<string, number>>(() => readLS(RATE_KEY, {}));
  useEffect(() => writeLS(RATE_KEY, ratings), [ratings]);
  const rate = useCallback((id: string, value: number) => {
    setRatings((prev) => ({ ...prev, [id]: value }));
  }, []);
  const getRating = useCallback((id: string) => ratings[id] ?? 0, [ratings]);
  return { ratings, rate, getRating };
}

export function useDarkMode() {
  // Keep the server and first browser render identical; hydrate the saved theme afterwards.
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY);
    setDark(stored ? stored === "dark" : (window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false));
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", dark);
    writeLS(THEME_KEY, dark ? "dark" : "light");
  }, [dark]);
  return { dark, toggle: () => setDark((v) => !v), setDark };
}
