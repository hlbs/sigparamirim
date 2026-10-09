import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { markNotificationRead, watchNotifications, type NotificationRecord } from './service';

function notificationTime(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    value = (value.toDate as () => Date)();
  }
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return 'Agora';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(value);
}

export function NotificationMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [error, setError] = useState('');
  const anchorRef = useRef<HTMLDivElement>(null);
  const unreadCount = items.filter((item) => !item.readAt).length;

  useEffect(() => {
    if (!user) { setItems([]); return undefined; }
    let disposed = false;
    let stop: (() => void) | undefined;
    void watchNotifications(user.uid, setItems, (listenError) => {
      if (!disposed) setError(listenError.message || 'Não foi possível carregar as notificações.');
    }).then((unsubscribe) => {
      if (disposed) unsubscribe();
      else { stop = unsubscribe; setError(''); }
    }).catch((listenError: unknown) => {
      if (!disposed) setError(listenError instanceof Error ? listenError.message : 'Notificações indisponíveis.');
    });
    return () => { disposed = true; stop?.(); };
  }, [user]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent) => {
      if (!anchorRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const activate = (item: NotificationRecord) => {
    if (!user) return;
    if (!item.readAt) void markNotificationRead(user.uid, item.id).catch((markError: unknown) => {
      setError(markError instanceof Error ? markError.message : 'Não foi possível atualizar a notificação.');
    });
    setOpen(false);
    const ticketId = item.ticketId || (item.resourceType === 'ticket' ? item.resourceId : undefined);
    if (ticketId) navigate(`/ajuda?ticket=${encodeURIComponent(ticketId)}`);
  };

  return <div className="notification-anchor" ref={anchorRef}>
    <button type="button" className="icon-button notification-trigger" aria-label={unreadCount ? `Notificações, ${unreadCount} não lidas` : 'Notificações'} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <i className="fa-solid fa-bell" aria-hidden="true" />
      {unreadCount > 0 && <span className="notification-count" aria-hidden="true">{unreadCount > 9 ? '9+' : unreadCount}</span>}
    </button>
    {open && <section className="notification-popover" role="dialog" aria-label="Notificações recentes">
      <header className="notification-popover-heading"><div><span className="eyebrow">Central de avisos</span><strong>Notificações</strong></div><span className="notification-unread-count">{unreadCount} não lidas</span></header>
      {error && <p className="notification-error" role="alert">{error}</p>}
      {!error && !items.length && <div className="notification-empty"><i className="fa-regular fa-bell-slash" /><strong>Tudo em dia</strong><span>Seus avisos de atendimento e da plataforma aparecerão aqui.</span></div>}
      {!!items.length && <ul className="notification-list">{items.map((item) => <li key={item.id}>
        <button type="button" className={`notification-item ${item.readAt ? 'is-read' : 'is-unread'}`} onClick={() => activate(item)}>
          <span className={`notification-item-icon ${item.type.startsWith('ticket') ? 'ticket' : 'general'}`}><i className={`fa-solid ${item.type.startsWith('ticket') ? 'fa-headset' : 'fa-bell'}`} /></span>
          <span className="notification-item-copy"><strong>{item.title}</strong><span>{item.body}</span><time>{notificationTime(item.createdAt)}</time></span>
          {!item.readAt && <span className="notification-unread-dot" aria-label="Não lida" />}
        </button>
      </li>)}</ul>}
      <footer className="notification-popover-footer"><span>Atualizadas em tempo real</span><i className="fa-solid fa-circle-check" /></footer>
    </section>}
  </div>;
}
