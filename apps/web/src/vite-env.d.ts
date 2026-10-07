/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface Window {
  particlesJS?: (tagId: string, params: Record<string, unknown>) => void;
}

interface ImportMetaEnv {
  readonly VITE_POWERBI_DASHBOARD_URL?: string;
}
