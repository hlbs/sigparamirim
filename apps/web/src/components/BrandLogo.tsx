import { useMemo } from 'react';
import { usePreferences } from '../stores/preferences';

export function BrandLogo({ kind = 'logo', alt = 'SIG Paramirim', className = '', variant = 'theme' }: { kind?: 'logo' | 'icon'; alt?: string; className?: string; variant?: 'theme' | 'light' | 'dark' }) {
  const theme = usePreferences((state) => state.theme);
  const dark = useMemo(() => theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches), [theme]);
  const suffix = variant === 'dark' || (variant === 'theme' && dark) ? 'b' : 'w';
  return <img className={className} src={`/${kind}_${suffix}.svg`} alt={alt} />;
}
