/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_AUTH_REDIRECT_URL?: string;
  /** "1" activa la búsqueda de actualizaciones (requiere latest.json firmado en Releases). */
  readonly VITE_DESKTOP_UPDATER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
