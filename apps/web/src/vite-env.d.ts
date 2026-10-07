/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface Window {
  particlesJS?: (tagId: string, params: Record<string, unknown>) => void;
}
