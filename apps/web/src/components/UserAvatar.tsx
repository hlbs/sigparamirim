type UserAvatarProps = {
  name?: string | null;
  email?: string | null;
  photoURL?: string | null;
  size?: 'small' | 'large';
};

function initialsFor(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.split('@')[0]?.replace(/[._-]+/g, ' ') || 'Usuário';
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('pt-BR'))
    .join('');
}

function colorFor(value: string) {
  let hash = 0;
  for (const character of value) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 42% 34%)`;
}

export function UserAvatar({ name, email, photoURL, size = 'small' }: UserAvatarProps) {
  const initials = initialsFor(name, email);
  const accessibleName = name || email || 'Usuário';

  if (photoURL) {
    return <img className={`user-avatar user-avatar-${size}`} src={photoURL} alt={`Foto de ${accessibleName}`} referrerPolicy="no-referrer" />;
  }

  return (
    <span
      className={`user-avatar user-avatar-${size}`}
      style={{ backgroundColor: colorFor(email || name || 'sig-paramirim') }}
      role="img"
      aria-label={`Iniciais de ${accessibleName}`}
    >
      {initials}
    </span>
  );
}
