import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import {
  archiveOwnNotifications,
  fetchNotificationHistory,
  markNotificationRead,
  watchNotifications,
  type NotificationRecord,
} from './service';

type View = 'inbox' | 'history';
type HistoryFilter = 'all' | 'unread' | 'read';

function notificationTime(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    value = (value.toDate as () => Date)();
  }
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return 'Agora';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(value);
}

function notificationIcon(item: NotificationRecord) {
  if (item.type.startsWith('ticket')) return 'fa-headset';
  if (item.resourceType === 'layer') return 'fa-layer-group';
  if (item.resourceType === 'publication') return 'fa-book-open';
  return 'fa-bell';
}

function notificationLabel(item: NotificationRecord) {
  if (item.readAt) return 'Visualizada';
  if (item.archivedAt) return 'Não visualizada · arquivada';
  return 'Não visualizada';
}

export function NotificationMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('inbox');
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [historyItems, setHistoryItems] = useState<NotificationRecord[]>([]);
  const [historyCursor, setHistoryCursor] = useState<Awaited<ReturnType<typeof fetchNotificationHistory>>['cursor']>();
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const anchorRef = useRef<HTMLDivElement>(null);
  const unreadCount = items.filter((item) => !item.readAt && !item.archivedAt).length;
  const inboxItems = items.filter((item) => !item.archivedAt).slice(0, 20);
  const visibleHistory = historyItems.filter((item) => {
    if (filter === 'unread') return !item.readAt;
    if (filter === 'read') return Boolean(item.readAt);
    return true;
  });

  useEffect(() => {
    if (!user) { setItems([]); setHistoryItems([]); return undefined; }
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
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const loadHistory = async (append = false) => {
    if (!user || loadingHistory) return;
    setLoadingHistory(true);
    setError('');
    try {
      const page = await fetchNotificationHistory(user.uid, append ? historyCursor : undefined);
      setHistoryItems((current) => append ? [...current, ...page.items] : page.items);
      setHistoryCursor(page.cursor);
      setHasMoreHistory(page.hasMore);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o histórico.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const showHistory = () => {
    setView('history');
    setMessage('');
    if (!historyItems.length) void loadHistory();
  };

  const activate = (item: NotificationRecord) => {
    if (!user) return;
    if (!item.readAt) void markNotificationRead(user.uid, item.id).catch((markError: unknown) => {
      setError(markError instanceof Error ? markError.message : 'Não foi possível atualizar a notificação.');
    });
    setOpen(false);
    const ticketId = item.ticketId || (item.resourceType === 'ticket' ? item.resourceId : undefined);
    if (ticketId) navigate(`/ajuda?ticket=${encodeURIComponent(ticketId)}`);
    else if (item.resourceType === 'layer') navigate('/mapa');
    else if (item.resourceType === 'publication') navigate('/observatorio');
  };

  const clearNotifications = async () => {
    if (!user || archiving || !unreadCount && !inboxItems.length) return;
    setArchiving(true);
    setError('');
    setMessage('');
    try {
      const result = await archiveOwnNotifications();
      setMessage(result.data.archived ? `${result.data.archived} notificação(ões) movida(s) para o histórico.` : 'A caixa de entrada já está limpa.');
      setView('inbox');
      setHistoryItems([]);
      setHistoryCursor(undefined);
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : 'Não foi possível limpar as notificações.');
    } finally {
      setArchiving(false);
    }
  };

  return <div className="notification-anchor" ref={anchorRef}>
    <button type="button" className="icon-button notification-trigger" aria-label={unreadCount ? `Notificações, ${unreadCount} não visualizadas` : 'Notificações'} aria-expanded={open} aria-controls="notification-popover" onClick={() => { setOpen((value) => !value); setMessage(''); }}>
      <i className="fa-solid fa-bell" aria-hidden="true" />
      {unreadCount > 0 && <span className="notification-count" aria-hidden="true">{unreadCount > 9 ? '9+' : unreadCount}</span>}
    </button>
    {open && <section id="notification-popover" className="notification-popover" role="dialog" aria-label="Central de notificações">
      <header className="notification-popover-heading"><div><span className="eyebrow">Central de avisos</span><strong>{view === 'history' ? 'Histórico' : 'Notificações'}</strong></div><span className="notification-unread-count">{unreadCount} não visualizadas</span></header>
      <div className="notification-view-actions">
        {view === 'history'
          ? <button type="button" className="notification-text-button" onClick={() => { setView('inbox'); setError(''); }}> <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Voltar aos avisos</button>
          : <button type="button" className="notification-text-button" onClick={showHistory}><i className="fa-solid fa-clock-rotate-left" aria-hidden="true" /> Histórico completo</button>}
        {view === 'inbox' && <button type="button" className="notification-text-button notification-clear-button" disabled={archiving || inboxItems.length === 0} onClick={() => void clearNotifications()}>{archiving ? <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> : <i className="fa-regular fa-trash-can" aria-hidden="true" />} Limpar</button>}
      </div>
      {view === 'history' && <div className="notification-history-filters" role="group" aria-label="Filtrar notificações por leitura">
        {([['all', 'Todas'], ['unread', 'Não visualizadas'], ['read', 'Visualizadas']] as const).map(([value, label]) => <button key={value} type="button" className={filter === value ? 'active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
      </div>}
      {error && <p className="notification-error" role="alert">{error}</p>}
      {message && <p className="notification-success" role="status">{message}</p>}
      {!error && view === 'inbox' && !inboxItems.length && <div className="notification-empty"><i className="fa-regular fa-bell-slash" aria-hidden="true" /><strong>Tudo em dia</strong><span>Seus avisos de atendimento e novidades da plataforma aparecerão aqui.</span></div>}
      {!error && view === 'history' && !loadingHistory && !visibleHistory.length && <div className="notification-empty"><i className="fa-regular fa-folder-open" aria-hidden="true" /><strong>Nenhum aviso neste filtro</strong><span>As notificações recebidas ficam registradas aqui, mesmo depois de limpar a caixa de entrada.</span></div>}
      {view === 'inbox' && !!inboxItems.length && <ul className="notification-list">{inboxItems.map((item) => <li key={item.id}>
        <button type="button" className={`notification-item ${item.readAt ? 'is-read' : 'is-unread'}`} onClick={() => activate(item)}>
          <span className={`notification-item-icon ${item.type.startsWith('ticket') ? 'ticket' : 'general'}`}><i className={`fa-solid ${notificationIcon(item)}`} aria-hidden="true" /></span>
          <span className="notification-item-copy"><strong>{item.title}</strong><span>{item.body}</span><time>{notificationTime(item.createdAt)}</time></span>
          {!item.readAt && <span className="notification-unread-dot" aria-label="Não visualizada" />}
        </button>
      </li>)}</ul>}
      {view === 'history' && !!visibleHistory.length && <ul className="notification-list notification-history-list">{visibleHistory.map((item) => <li key={item.id}>
        <button type="button" className={`notification-item ${item.readAt ? 'is-read' : 'is-unread'}`} onClick={() => activate(item)}>
          <span className={`notification-item-icon ${item.type.startsWith('ticket') ? 'ticket' : 'general'}`}><i className={`fa-solid ${notificationIcon(item)}`} aria-hidden="true" /></span>
          <span className="notification-item-copy"><strong>{item.title}</strong><span>{item.body}</span><time>{notificationTime(item.createdAt)}</time></span>
          <span className={`notification-status-flag ${item.readAt ? 'is-read' : 'is-unread'}`}>{notificationLabel(item)}</span>
        </button>
      </li>)}</ul>}
      {view === 'history' && hasMoreHistory && <button type="button" className="notification-load-more" disabled={loadingHistory} onClick={() => void loadHistory(true)}>{loadingHistory ? 'Carregando…' : 'Carregar mais notificações'}</button>}
      <footer className="notification-popover-footer"><span>{view === 'history' ? 'Histórico pessoal · somente neste menu' : 'Avisos atualizados em tempo real'}</span><i className="fa-solid fa-circle-check" aria-hidden="true" /></footer>
    </section>}
  </div>;
}
