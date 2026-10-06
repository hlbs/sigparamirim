export const EDITORIAL_ENTITY_TYPES = ['layer', 'dashboard', 'publication'] as const;
export type EditorialEntityType = (typeof EDITORIAL_ENTITY_TYPES)[number];

export const EDITORIAL_STATUSES = [
  'draft',
  'pending',
  'approved',
  'rejected',
  'cancelled',
] as const;
export type EditorialStatus = (typeof EDITORIAL_STATUSES)[number];

export type EditorialRole = 'editor' | 'admin';

export interface EditorialActor {
  id: string;
  role: EditorialRole;
}

export type EditorialEventAction =
  | 'created'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'reopened';

export interface EditorialEvent {
  id: string;
  sequence: number;
  action: EditorialEventAction;
  from: EditorialStatus | null;
  to: EditorialStatus;
  actorId: string;
  actorRole: EditorialRole;
  occurredAt: string;
  justification?: string;
}

export interface EditorialChangeRequest {
  id: string;
  entityType: EditorialEntityType;
  entityId: string;
  title: string;
  proposedChanges: Readonly<Record<string, unknown>>;
  status: EditorialStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  events: readonly EditorialEvent[];
}

export interface CreateEditorialChangeRequestInput {
  id: string;
  entityType: EditorialEntityType;
  entityId: string;
  title: string;
  proposedChanges: Readonly<Record<string, unknown>>;
}

export interface EditorialTransitionCommand {
  to: EditorialStatus;
  justification?: string;
}

export interface EditorialTransitionResult {
  request: EditorialChangeRequest;
  event: EditorialEvent;
}

export type EditorialValidationResult =
  | { valid: true; errors: readonly [] }
  | { valid: false; errors: readonly string[] };

export type EditorialErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_TRANSITION'
  | 'UNAUTHORIZED'
  | 'JUSTIFICATION_REQUIRED'
  | 'INVALID_TIMESTAMP';

export class EditorialDomainError extends Error {
  constructor(
    public readonly code: EditorialErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'EditorialDomainError';
  }
}

const transitionActions: Readonly<
  Partial<Record<EditorialStatus, Partial<Record<EditorialStatus, EditorialEventAction>>>>
> = {
  draft: { pending: 'submitted', cancelled: 'cancelled' },
  pending: { approved: 'approved', rejected: 'rejected', cancelled: 'cancelled' },
  rejected: { draft: 'reopened', cancelled: 'cancelled' },
};

const MAX_ID_LENGTH = 128;
const MAX_TITLE_LENGTH = 200;
const MAX_JUSTIFICATION_LENGTH = 2_000;
const MAX_JSON_DEPTH = 20;

export function createEditorialChangeRequest(
  input: CreateEditorialChangeRequestInput,
  actor: EditorialActor,
  occurredAt: string,
): EditorialChangeRequest {
  assertActor(actor);
  assertCanonicalTimestamp(occurredAt);

  const id = normalizeRequiredText(input.id, 'id', MAX_ID_LENGTH);
  const entityId = normalizeRequiredText(input.entityId, 'entityId', MAX_ID_LENGTH);
  const title = normalizeRequiredText(input.title, 'title', MAX_TITLE_LENGTH);

  if (!EDITORIAL_ENTITY_TYPES.includes(input.entityType)) {
    throw new EditorialDomainError('INVALID_INPUT', 'Tipo de entidade editorial inválido.');
  }

  assertValidChanges(input.proposedChanges);

  const event: EditorialEvent = {
    id: buildEventId(id, 1, 'created'),
    sequence: 1,
    action: 'created',
    from: null,
    to: 'draft',
    actorId: actor.id.trim(),
    actorRole: actor.role,
    occurredAt,
  };

  return {
    id,
    entityType: input.entityType,
    entityId,
    title,
    proposedChanges: input.proposedChanges,
    status: 'draft',
    createdBy: actor.id.trim(),
    createdAt: occurredAt,
    updatedAt: occurredAt,
    revision: 1,
    events: [event],
  };
}

export function transitionEditorialChangeRequest(
  request: EditorialChangeRequest,
  command: EditorialTransitionCommand,
  actor: EditorialActor,
  occurredAt: string,
): EditorialTransitionResult {
  assertValidRequest(request);
  assertActor(actor);
  assertCanonicalTimestamp(occurredAt);

  if (Date.parse(occurredAt) < Date.parse(request.updatedAt)) {
    throw new EditorialDomainError(
      'INVALID_TIMESTAMP',
      'O evento não pode ocorrer antes da última atualização do pedido.',
    );
  }

  const action = transitionActions[request.status]?.[command.to];
  if (!action) {
    throw new EditorialDomainError(
      'INVALID_TRANSITION',
      `Transição de ${request.status} para ${command.to} não permitida.`,
    );
  }

  assertAuthorized(request, command.to, actor);
  const justification = normalizeOptionalText(command.justification, MAX_JUSTIFICATION_LENGTH);

  if ((command.to === 'approved' || command.to === 'rejected') && !justification) {
    throw new EditorialDomainError(
      'JUSTIFICATION_REQUIRED',
      'A aprovação ou rejeição exige uma justificativa.',
    );
  }

  const sequence = request.events.length + 1;
  const event: EditorialEvent = {
    id: buildEventId(request.id, sequence, action),
    sequence,
    action,
    from: request.status,
    to: command.to,
    actorId: actor.id.trim(),
    actorRole: actor.role,
    occurredAt,
    ...(justification ? { justification } : {}),
  };

  return {
    request: {
      ...request,
      status: command.to,
      updatedAt: occurredAt,
      revision: request.revision + 1,
      events: [...request.events, event],
    },
    event,
  };
}

export function validateEditorialChangeRequest(
  request: EditorialChangeRequest,
): EditorialValidationResult {
  const errors: string[] = [];

  collect(() => normalizeRequiredText(request.id, 'id', MAX_ID_LENGTH), errors);
  collect(() => normalizeRequiredText(request.entityId, 'entityId', MAX_ID_LENGTH), errors);
  collect(() => normalizeRequiredText(request.title, 'title', MAX_TITLE_LENGTH), errors);
  collect(() => normalizeRequiredText(request.createdBy, 'createdBy', MAX_ID_LENGTH), errors);
  collect(() => assertCanonicalTimestamp(request.createdAt), errors);
  collect(() => assertCanonicalTimestamp(request.updatedAt), errors);
  collect(() => assertValidChanges(request.proposedChanges), errors);

  if (!EDITORIAL_ENTITY_TYPES.includes(request.entityType)) errors.push('Tipo de entidade inválido.');
  if (!EDITORIAL_STATUSES.includes(request.status)) errors.push('Estado editorial inválido.');
  if (!Number.isInteger(request.revision) || request.revision < 1) errors.push('Revisão inválida.');
  if (!Array.isArray(request.events) || request.events.length === 0) {
    errors.push('O histórico de eventos é obrigatório.');
  } else {
    validateEventHistory(request, errors);
  }

  if (isCanonicalTimestamp(request.createdAt) && isCanonicalTimestamp(request.updatedAt)) {
    if (Date.parse(request.updatedAt) < Date.parse(request.createdAt)) {
      errors.push('updatedAt não pode ser anterior a createdAt.');
    }
  }

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors };
}

function assertValidRequest(request: EditorialChangeRequest): void {
  const result = validateEditorialChangeRequest(request);
  if (!result.valid) {
    throw new EditorialDomainError('INVALID_INPUT', result.errors.join(' '));
  }
}

function validateEventHistory(request: EditorialChangeRequest, errors: string[]): void {
  let expectedFrom: EditorialStatus | null = null;
  let previousTimestamp = -Infinity;

  request.events.forEach((event, index) => {
    const expectedSequence = index + 1;
    if (event.sequence !== expectedSequence) errors.push(`Sequência inválida no evento ${expectedSequence}.`);
    if (event.from !== expectedFrom) errors.push(`Estado de origem inconsistente no evento ${expectedSequence}.`);
    if (!EDITORIAL_STATUSES.includes(event.to)) errors.push(`Estado de destino inválido no evento ${expectedSequence}.`);
    if (event.actorRole !== 'editor' && event.actorRole !== 'admin') {
      errors.push(`Papel inválido no evento ${expectedSequence}.`);
    }
    collect(
      () => normalizeRequiredText(event.actorId, 'actorId', MAX_ID_LENGTH),
      errors,
      `Evento ${expectedSequence}: `,
    );
    collect(
      () => assertCanonicalTimestamp(event.occurredAt),
      errors,
      `Evento ${expectedSequence}: `,
    );
    if (isCanonicalTimestamp(event.occurredAt)) {
      const currentTimestamp = Date.parse(event.occurredAt);
      if (currentTimestamp < previousTimestamp) errors.push(`Cronologia inválida no evento ${expectedSequence}.`);
      previousTimestamp = currentTimestamp;
    }
    const justification =
      typeof event.justification === 'string' ? event.justification.trim() : undefined;
    if (event.justification !== undefined && typeof event.justification !== 'string') {
      errors.push(`Justificativa inválida no evento ${expectedSequence}.`);
    } else if (justification && justification.length > MAX_JUSTIFICATION_LENGTH) {
      errors.push(`Justificativa excessiva no evento ${expectedSequence}.`);
    }
    if ((event.to === 'approved' || event.to === 'rejected') && !justification) {
      errors.push(`Justificativa ausente no evento ${expectedSequence}.`);
    }
    if ((event.to === 'approved' || event.to === 'rejected') && event.actorRole !== 'admin') {
      errors.push(`Decisão administrativa inválida no evento ${expectedSequence}.`);
    }

    const expectedAction =
      index === 0
        ? 'created'
        : event.from
          ? transitionActions[event.from]?.[event.to]
          : undefined;
    if (event.action !== expectedAction) {
      errors.push(`Ação incompatível com a transição no evento ${expectedSequence}.`);
    }
    if (event.id !== buildEventId(request.id, expectedSequence, event.action)) {
      errors.push(`Identificador inválido no evento ${expectedSequence}.`);
    }
    expectedFrom = event.to;
  });

  const first = request.events[0];
  const last = request.events.at(-1);
  if (first?.action !== 'created' || first.from !== null || first.to !== 'draft') {
    errors.push('O primeiro evento deve registrar a criação do rascunho.');
  }
  if (first?.actorId !== request.createdBy) {
    errors.push('O autor não corresponde ao evento de criação.');
  }
  if (last?.to !== request.status) errors.push('O último evento não corresponde ao estado atual.');
  if (request.revision !== request.events.length) errors.push('A revisão não corresponde ao histórico.');
  if (first?.occurredAt !== request.createdAt) errors.push('A criação não corresponde ao primeiro evento.');
  if (last?.occurredAt !== request.updatedAt) errors.push('A atualização não corresponde ao último evento.');
}

function assertAuthorized(
  request: EditorialChangeRequest,
  target: EditorialStatus,
  actor: EditorialActor,
): void {
  if (target === 'approved' || target === 'rejected') {
    if (actor.role !== 'admin') {
      throw new EditorialDomainError(
        'UNAUTHORIZED',
        'Somente administradores podem aprovar ou rejeitar pedidos.',
      );
    }
    return;
  }

  if (actor.role === 'editor' && actor.id.trim() !== request.createdBy) {
    throw new EditorialDomainError(
      'UNAUTHORIZED',
      'Editores só podem alterar seus próprios pedidos.',
    );
  }
}

function assertActor(actor: EditorialActor): void {
  normalizeRequiredText(actor.id, 'actor.id', MAX_ID_LENGTH);
  if (actor.role !== 'editor' && actor.role !== 'admin') {
    throw new EditorialDomainError('UNAUTHORIZED', 'Papel editorial não autorizado.');
  }
}

function assertValidChanges(value: unknown): asserts value is Readonly<Record<string, unknown>> {
  if (!isPlainObject(value) || Object.keys(value).length === 0) {
    throw new EditorialDomainError(
      'INVALID_INPUT',
      'proposedChanges deve ser um objeto não vazio.',
    );
  }

  const seen = new WeakSet<object>();
  if (!isJsonSafe(value, 0, seen)) {
    throw new EditorialDomainError(
      'INVALID_INPUT',
      'proposedChanges deve conter somente valores JSON válidos e finitos.',
    );
  }
}

function isJsonSafe(value: unknown, depth: number, seen: WeakSet<object>): boolean {
  if (depth > MAX_JSON_DEPTH) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;

  seen.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonSafe(item, depth + 1, seen))
    : isPlainObject(value) &&
      Object.entries(value).every(
        ([key, item]) => key.length > 0 && isJsonSafe(item, depth + 1, seen),
      );
  seen.delete(value);
  return valid;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeRequiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new EditorialDomainError('INVALID_INPUT', `${field} é obrigatório.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new EditorialDomainError(
      'INVALID_INPUT',
      `${field} deve ter no máximo ${maxLength} caracteres.`,
    );
  }
  return normalized;
}

function normalizeOptionalText(value: unknown, maxLength: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new EditorialDomainError('INVALID_INPUT', 'A justificativa deve ser textual.');
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new EditorialDomainError(
      'INVALID_INPUT',
      `A justificativa deve ter no máximo ${maxLength} caracteres.`,
    );
  }
  return normalized || undefined;
}

function assertCanonicalTimestamp(value: unknown): asserts value is string {
  if (!isCanonicalTimestamp(value)) {
    throw new EditorialDomainError(
      'INVALID_TIMESTAMP',
      'A data deve estar no formato ISO 8601 UTC canônico.',
    );
  }
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function buildEventId(
  requestId: string,
  sequence: number,
  action: EditorialEventAction,
): string {
  return `${requestId}:${sequence}:${action}`;
}

function collect(
  operation: () => unknown,
  errors: string[],
  prefix = '',
): void {
  try {
    operation();
  } catch (error) {
    errors.push(`${prefix}${error instanceof Error ? error.message : 'Valor inválido.'}`);
  }
}
