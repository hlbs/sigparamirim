import { useMemo } from 'react';
import { usePreferences } from '../stores/preferences';

export function BrandLogo({ kind = 'logo', alt = 'SIG Paramirim', className = '' }: { kind?: 'logo' | 'icon'; alt?: string; className?: string }) {
  const theme = usePreferences((state) => state.theme);
  const dark = useMemo(() => theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches), [theme]);
  return <img className={className} src={dark ? `/${kind}_b.svg` : `/${kind}_w.svg`} alt={alt} />;
}
