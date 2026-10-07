import { useMemo } from 'react';
import { usePreferences } from '../stores/preferences';

export function ThemeDetail({ className = '' }: { className?: string }) {
  const theme = usePreferences((state) => state.theme);
  const dark = useMemo(() => theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches), [theme]);
  return <img className={`theme-detail ${className}`} src={dark ? '/detail_b.svg' : '/detail_w.svg'} alt="" aria-hidden="true" />;
}
