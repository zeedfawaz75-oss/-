type RuntimeProcess = {
  env?: Record<string, string | undefined>;
};

type SupabaseImportMetaEnv = ImportMetaEnv & {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
};

export function getSupabasePublicConfig() {
  const importEnv = import.meta.env as SupabaseImportMetaEnv;
  const runtimeEnv = (globalThis as typeof globalThis & { process?: RuntimeProcess }).process?.env;

  return {
    url:
      importEnv.VITE_SUPABASE_URL ||
      runtimeEnv?.VITE_SUPABASE_URL ||
      importEnv.SUPABASE_URL ||
      runtimeEnv?.SUPABASE_URL,
    publishableKey:
      importEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
      runtimeEnv?.VITE_SUPABASE_PUBLISHABLE_KEY ||
      importEnv.SUPABASE_PUBLISHABLE_KEY ||
      runtimeEnv?.SUPABASE_PUBLISHABLE_KEY,
  };
}
