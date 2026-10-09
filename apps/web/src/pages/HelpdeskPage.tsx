import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserAvatar } from '../components/UserAvatar';
import { useAuth } from '../features/auth';
import {
  createTicket,
  replyToTicket,
  updateTicketStatus,
  watchTicketEvents,
  watchTicketMessages,
  watchTickets,
  type TicketCategory,
  type TicketEvent,
  type TicketMessage,
  type TicketPriority,
  type TicketRecord,
  type TicketStatus,
} from '../features/helpdesk/service';

const statuses: Record<TicketStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em atendimento',
  waiting_for_user: 'Aguardando você',
  resolved: 'Resolvido',
  closed: 'Encerrado',
};
const categories: Record<TicketCategory, string> = {
  access: 'Acesso e conta',
  map: 'Mapa e camadas',
  data: 'Dados e informações',
  dashboard: 'Dashboard',
  bug: 'Erro ou instabilidade',
  other: 'Outro assunto',
};
const statusOrder: TicketStatus[] = ['open', 'in_progress', 'waiting_for_user', 'resolved', 'closed'];

function dateValue(value: unknown) {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return (value.toDate as () => Date)();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function formatDate(value: unknown, includeTime = true) {
  const date = dateValue(value);
  if (!date) return 'Agora mesmo';
  return new Intl.DateTimeFormat('pt-BR', includeTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }).format(date);
}

function ticketLabel(id: string) { return `#${id.slice(0, 8).toUpperCase()}`; }

function errorMessage(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code.includes('permission-denied')) return 'Sua conta não tem permissão para esta ação.';
  if (code.includes('failed-precondition')) return error instanceof Error ? error.message : 'Esta ação não está disponível para o estado atual do chamado.';
  if (code.includes('unavailable') || code.includes('network')) return 'Não foi possível conectar ao atendimento. Verifique sua conexão e tente novamente.';
  return error instanceof Error ? error.message : 'Não foi possível concluir a solicitação.';
}

export function HelpdeskPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const ticketParam = searchParams.get('ticket');
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'waiting' | 'done'>('all');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [ticketError, setTicketError] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamError, setStreamError] = useState('');
  const [draftTicket, setDraftTicket] = useState({ subject: '', category: 'other' as TicketCategory, priority: 'normal' as TicketPriority, message: '' });
  const messageEndRef = useRef<HTMLDivElement>(null);
  const selectedTicket = tickets.find((ticket) => ticket.id === ticketParam) ?? null;

  useEffect(() => {
    if (!user) return undefined;
    setLoading(true);
    let disposed = false;
    let stop: (() => void) | undefined;
    void watchTickets(user.uid, isAdmin, (items) => {
      if (disposed) return;
      setTickets(items);
      setLoading(false);
    }, (error) => {
      if (disposed) return;
      setStreamError(errorMessage(error));
      setLoading(false);
    }).then((unsubscribe) => {
      if (disposed) unsubscribe();
      else stop = unsubscribe;
    }).catch((error: unknown) => {
      if (disposed) return;
      setStreamError(errorMessage(error));
      setLoading(false);
    });
    return () => { disposed = true; stop?.(); };
  }, [isAdmin, user]);

  useEffect(() => {
    if (!ticketParam) {
      setMessages([]);
      setEvents([]);
      return undefined;
    }
    let disposed = false;
    let stopMessages: (() => void) | undefined;
    let stopEvents: (() => void) | undefined;
    setDetailLoading(true);
    setMessages([]);
    setEvents([]);
    setStreamError('');
    Promise.all([
      watchTicketMessages(ticketParam, (items) => { if (!disposed) { setMessages(items); setDetailLoading(false); } }, (error) => { if (!disposed) { setStreamError(errorMessage(error)); setDetailLoading(false); } }),
      watchTicketEvents(ticketParam, (items) => { if (!disposed) setEvents(items); }, (error) => { if (!disposed) setStreamError(errorMessage(error)); }),
    ]).then(([stopMessagesNow, stopEventsNow]) => {
      if (disposed) { stopMessagesNow(); stopEventsNow(); }
      else { stopMessages = stopMessagesNow; stopEvents = stopEventsNow; }
    }).catch((error: unknown) => {
      if (!disposed) { setStreamError(errorMessage(error)); setDetailLoading(false); }
    });
    return () => { disposed = true; stopMessages?.(); stopEvents?.(); };
  }, [ticketParam]);

  useEffect(() => {
    if (messages.length) messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const filteredTickets = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
    return tickets.filter((ticket) => {
      const matchesStatus = filter === 'all'
        || (filter === 'active' && ['open', 'in_progress'].includes(ticket.status))
        || (filter === 'waiting' && ticket.status === 'waiting_for_user')
        || (filter === 'done' && ['resolved', 'closed'].includes(ticket.status));
      const matchesSearch = !normalizedSearch || `${ticket.subject} ${ticket.ownerName} ${ticket.ownerEmail} ${ticket.id}`.toLocaleLowerCase('pt-BR').includes(normalizedSearch);
      return matchesStatus && matchesSearch;
    });
  }, [filter, search, tickets]);

  const selectTicket = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('ticket', id);
    else next.delete('ticket');
    setSearchParams(next, { replace: true });
  };

  const openTicketForm = () => { setTicketError(''); setShowCreate(true); };

  const submitTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setTicketError('');
    try {
      const result = await createTicket(draftTicket);
      setShowCreate(false);
      setDraftTicket({ subject: '', category: 'other', priority: 'normal', message: '' });
      selectTicket(result.ticketId);
    } catch (error) { setTicketError(errorMessage(error)); }
    finally { setBusy(false); }
  };

  const submitReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTicket || !draft.trim() || busy) return;
    setBusy(true); setTicketError('');
    try {
      await replyToTicket({ ticketId: selectedTicket.id, message: draft.trim() });
      setDraft('');
    } catch (error) { setTicketError(errorMessage(error)); }
    finally { setBusy(false); }
  };

  const changeStatus = async (status: TicketStatus) => {
    if (!selectedTicket || busy) return;
    setBusy(true); setTicketError('');
    try { await updateTicketStatus({ ticketId: selectedTicket.id, status }); }
    catch (error) { setTicketError(errorMessage(error)); }
    finally { setBusy(false); }
  };

  const statusCounts = useMemo(() => statusOrder.reduce((counts, status) => {
    counts[status] = tickets.filter((ticket) => ticket.status === status).length;
    return counts;
  }, {} as Record<TicketStatus, number>), [tickets]);

  return (
    <section className="helpdesk-page" aria-labelledby="helpdesk-title">
      <header className="helpdesk-heading">
        <div className="helpdesk-heading-copy">
          <span className="eyebrow"><i className="fa-solid fa-headset" /> Central de atendimento</span>
          <h1 id="helpdesk-title">Como podemos ajudar?</h1>
          <p>Abra um chamado e acompanhe cada resposta e atualização em um só lugar.</p>
        </div>
        <button className="button button-primary helpdesk-new-button" type="button" onClick={openTicketForm}>
          <i className="fa-solid fa-plus" /> Novo chamado
        </button>
      </header>

      <div className="helpdesk-stats" aria-label="Resumo dos chamados">
        <div><span className="helpdesk-stat-icon open"><i className="fa-regular fa-folder-open" /></span><span><strong>{statusCounts.open + statusCounts.in_progress}</strong><small>Em andamento</small></span></div>
        <div><span className="helpdesk-stat-icon waiting"><i className="fa-regular fa-clock" /></span><span><strong>{statusCounts.waiting_for_user}</strong><small>Aguardando retorno</small></span></div>
        <div><span className="helpdesk-stat-icon resolved"><i className="fa-solid fa-check" /></span><span><strong>{statusCounts.resolved + statusCounts.closed}</strong><small>Resolvidos</small></span></div>
        <div className="helpdesk-sla-note"><i className="fa-solid fa-shield-halved" /><span><strong>Atendimento registrado</strong><small>Você receberá avisos sobre novas respostas.</small></span></div>
      </div>

      <div className={`helpdesk-workspace ${selectedTicket ? 'has-selection' : ''}`}>
        <aside className="helpdesk-list-panel" aria-label={isAdmin ? 'Fila de atendimento' : 'Meus chamados'}>
          <div className="helpdesk-list-heading">
            <div><span className="eyebrow">{isAdmin ? 'Equipe de suporte' : 'Seu histórico'}</span><h2>{isAdmin ? 'Fila de atendimento' : 'Meus chamados'} <span>{tickets.length}</span></h2></div>
            <button className="helpdesk-icon-button" type="button" onClick={openTicketForm} aria-label="Criar chamado"><i className="fa-solid fa-plus" /></button>
          </div>
          <label className="helpdesk-search"><i className="fa-solid fa-magnifying-glass" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isAdmin ? 'Buscar por assunto ou solicitante' : 'Buscar chamado'} aria-label="Buscar chamados" /></label>
          <div className="helpdesk-filter-row" aria-label="Filtrar chamados">
            <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todos</button>
            <button type="button" className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>Em andamento</button>
            <button type="button" className={filter === 'waiting' ? 'active' : ''} onClick={() => setFilter('waiting')}>Aguardando</button>
            <button type="button" className={filter === 'done' ? 'active' : ''} onClick={() => setFilter('done')}>Concluídos</button>
          </div>
          <div className="helpdesk-ticket-list">
            {loading ? <div className="helpdesk-list-state"><span className="loading-spinner" />Carregando chamados…</div> : null}
            {!loading && !filteredTickets.length && <div className="helpdesk-list-empty"><span><i className="fa-regular fa-comments" /></span><strong>{tickets.length ? 'Nenhum resultado' : 'Sua caixa de atendimento está vazia'}</strong><p>{tickets.length ? 'Ajuste a busca ou o filtro.' : 'Quando você abrir um chamado, a conversa ficará registrada aqui.'}</p></div>}
            {filteredTickets.map((ticket) => (
              <button type="button" key={ticket.id} className={`helpdesk-ticket-card ${ticket.id === ticketParam ? 'selected' : ''}`} onClick={() => selectTicket(ticket.id)}>
                <div className="helpdesk-ticket-card-top"><span>{ticketLabel(ticket.id)}</span><span className={`helpdesk-status status-${ticket.status}`}>{statuses[ticket.status]}</span></div>
                <strong>{ticket.subject}</strong>
                <div className="helpdesk-ticket-card-meta"><span>{categories[ticket.category]}</span>{ticket.priority === 'high' && <span className="helpdesk-priority"><i className="fa-solid fa-bolt" /> Prioritário</span>}</div>
                <div className="helpdesk-ticket-card-bottom"><span>{isAdmin ? ticket.ownerName : formatDate(ticket.updatedAt)}</span><span><i className="fa-regular fa-message" /> {ticket.messageCount}</span></div>
              </button>
            ))}
          </div>
        </aside>

        <main className="helpdesk-conversation-panel">
          {streamError && <div className="helpdesk-alert" role="alert"><i className="fa-solid fa-triangle-exclamation" />{streamError}</div>}
          {selectedTicket ? <>
            <header className="helpdesk-conversation-header">
              <button type="button" className="helpdesk-back-button" onClick={() => selectTicket(null)} aria-label="Voltar para lista"><i className="fa-solid fa-arrow-left" /></button>
              <div className="helpdesk-conversation-title"><div className="helpdesk-conversation-id">{ticketLabel(selectedTicket.id)} <span>·</span> {categories[selectedTicket.category]}</div><h2>{selectedTicket.subject}</h2><p>{isAdmin ? `Solicitado por ${selectedTicket.ownerName}${selectedTicket.ownerEmail ? ` · ${selectedTicket.ownerEmail}` : ''}` : `Aberto em ${formatDate(selectedTicket.createdAt)}`}</p></div>
              <span className={`helpdesk-status status-${selectedTicket.status}`}>{statuses[selectedTicket.status]}</span>
            </header>
            {isAdmin && <div className="helpdesk-admin-toolbar"><span><i className="fa-solid fa-user-shield" /> Gestão do atendimento</span><label>Estado<select value={selectedTicket.status} disabled={busy} onChange={(event) => void changeStatus(event.target.value as TicketStatus)}>{statusOrder.map((status) => <option value={status} key={status}>{statuses[status]}</option>)}</select></label></div>}
            <div className="helpdesk-conversation-scroll">
              <div className="helpdesk-opened-note"><span><i className="fa-solid fa-paper-plane" /></span><div><strong>Chamado recebido</strong><small>{formatDate(selectedTicket.createdAt)}{selectedTicket.priority === 'high' ? ' · Prioridade alta' : ''}</small></div></div>
              {detailLoading && <div className="helpdesk-list-state"><span className="loading-spinner" />Carregando histórico…</div>}
              {!detailLoading && messages.map((message) => {
                const ownMessage = message.authorUid === user?.uid;
                return <article key={message.id} className={`helpdesk-message ${ownMessage ? 'own' : 'other'} ${message.authorRole === 'admin' ? 'staff' : ''}`}>
                  <div className="helpdesk-message-avatar"><UserAvatar name={message.authorName} email={message.authorUid} size="small" /></div>
                  <div className="helpdesk-message-content"><div className="helpdesk-message-meta"><strong>{ownMessage ? 'Você' : message.authorName}</strong>{message.authorRole === 'admin' && <span>Equipe de suporte</span>}<time>{formatDate(message.createdAt)}</time></div><p>{message.body}</p></div>
                </article>;
              })}
              {!detailLoading && events.length > 1 && <details className="helpdesk-history"><summary><i className="fa-solid fa-clock-rotate-left" /> Histórico de atendimento <span>{events.length}</span></summary><ol>{events.slice(1).map((event) => <li key={event.id}><span className="helpdesk-history-dot" /><div><strong>{event.action === 'reply' ? 'Mensagem adicionada' : event.action === 'reopened_by_requester' ? 'Chamado reaberto pelo solicitante' : event.action === 'status_changed' ? `Estado alterado: ${statuses[event.to]}` : event.action}</strong><small>{event.actorName} · {formatDate(event.createdAt)}</small></div></li>)}</ol></details>}
              <div ref={messageEndRef} />
            </div>
            {ticketError && <div className="helpdesk-inline-error" role="alert">{ticketError}</div>}
            {selectedTicket.status === 'resolved' && !isAdmin && <div className="helpdesk-resolved-callout"><i className="fa-solid fa-circle-check" /><span><strong>Este chamado foi marcado como resolvido.</strong><small>Se a resposta resolveu sua solicitação, você pode encerrá-lo. Caso contrário, responda para reabri-lo.</small></span><button className="button button-outline" type="button" disabled={busy} onClick={() => void changeStatus('closed')}>Encerrar chamado</button></div>}
            {(selectedTicket.status !== 'closed' || !isAdmin) ? <form className="helpdesk-reply-form" onSubmit={(event) => void submitReply(event)}>
              <label htmlFor="helpdesk-reply">{isAdmin ? 'Responder ao solicitante' : 'Adicionar uma resposta'}</label>
              <div className="helpdesk-reply-box"><textarea id="helpdesk-reply" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={isAdmin ? 'Escreva uma resposta clara e objetiva…' : 'Descreva mais detalhes ou responda à equipe…'} maxLength={5000} rows={3} disabled={busy} /><div><small>{draft.length.toLocaleString('pt-BR')} / 5.000</small><button type="submit" className="button button-primary" disabled={busy || draft.trim().length < 2}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} /> {busy ? 'Enviando…' : 'Enviar resposta'}</button></div></div>
              <small className="helpdesk-private-note"><i className="fa-solid fa-lock" /> Esta conversa é privada e visível somente ao solicitante e à equipe de suporte.</small>
            </form> : <div className="helpdesk-closed-note"><i className="fa-solid fa-lock" /> Chamado encerrado. Se precisar de ajuda novamente, abra um novo chamado.</div>}
          </> : (
            <div className="helpdesk-welcome">
              <span className="helpdesk-welcome-icon"><i className="fa-regular fa-comments" /></span>
              <span className="eyebrow">Atendimento SIG Paramirim</span>
              <h2>{isAdmin ? 'Sua fila de atendimento' : 'Estamos aqui para ajudar'}</h2>
              <p>{isAdmin ? 'Selecione um chamado para consultar o histórico, responder ao solicitante e atualizar o andamento.' : 'Selecione um chamado para acompanhar a conversa ou crie um novo para falar com nossa equipe.'}</p>
              <button type="button" className="button button-primary" onClick={openTicketForm}><i className="fa-solid fa-plus" /> Abrir um chamado</button>
              {isAdmin && <span className="helpdesk-queue-hint"><i className="fa-solid fa-bell" /> Novos chamados também aparecem nas notificações da plataforma.</span>}
            </div>
          )}
        </main>
      </div>

      {showCreate && <div className="helpdesk-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) setShowCreate(false); }}>
        <section className="helpdesk-create-modal" role="dialog" aria-modal="true" aria-labelledby="helpdesk-create-title">
          <button type="button" className="helpdesk-modal-close" onClick={() => setShowCreate(false)} disabled={busy} aria-label="Fechar formulário"><i className="fa-solid fa-xmark" /></button>
          <span className="eyebrow"><i className="fa-solid fa-headset" /> Novo atendimento</span>
          <h2 id="helpdesk-create-title">Conte como podemos ajudar</h2>
          <p>Informe o assunto e os detalhes. Você poderá acompanhar as respostas pelo histórico e pelas notificações.</p>
          <form onSubmit={(event) => void submitTicket(event)}>
            <label>Assunto<input required minLength={5} maxLength={140} value={draftTicket.subject} onChange={(event) => setDraftTicket((current) => ({ ...current, subject: event.target.value }))} placeholder="Ex.: Não consigo visualizar uma camada" /></label>
            <div className="helpdesk-form-row"><label>Categoria<select value={draftTicket.category} onChange={(event) => setDraftTicket((current) => ({ ...current, category: event.target.value as TicketCategory }))}>{Object.entries(categories).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Prioridade<select value={draftTicket.priority} onChange={(event) => setDraftTicket((current) => ({ ...current, priority: event.target.value as TicketPriority }))}><option value="normal">Normal</option><option value="high">Alta</option></select></label></div>
            <label>Descrição<textarea required minLength={20} maxLength={5000} rows={6} value={draftTicket.message} onChange={(event) => setDraftTicket((current) => ({ ...current, message: event.target.value }))} placeholder="Descreva o que aconteceu, o que você esperava e, se possível, os passos para reproduzir." /><small>{draftTicket.message.length.toLocaleString('pt-BR')} / 5.000 caracteres</small></label>
            {ticketError && <div className="helpdesk-inline-error" role="alert">{ticketError}</div>}
            <div className="helpdesk-modal-actions"><button type="button" className="button button-outline" disabled={busy} onClick={() => setShowCreate(false)}>Cancelar</button><button type="submit" className="button button-primary" disabled={busy || draftTicket.subject.trim().length < 5 || draftTicket.message.trim().length < 20}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} /> {busy ? 'Enviando chamado…' : 'Enviar chamado'}</button></div>
          </form>
        </section>
      </div>}
    </section>
  );
}
