import { describe, expect, it } from 'vitest';
import {
  createEditorialChangeRequest,
  EditorialDomainError,
  transitionEditorialChangeRequest,
  validateEditorialChangeRequest,
  type EditorialActor,
} from './editorial';

const editor: EditorialActor = { id: 'editor-1', role: 'editor' };
const otherEditor: EditorialActor = { id: 'editor-2', role: 'editor' };
const admin: EditorialActor = { id: 'admin-1', role: 'admin' };
const createdAt = '2026-10-05T18:00:00.000Z';

function makeDraft() {
  return createEditorialChangeRequest(
    {
      id: 'cr-001',
      entityType: 'layer',
      entityId: 'hidrografia',
      title: 'Atualizar simbologia da hidrografia',
      proposedChanges: { stroke: '#0055aa', width: 2 },
    },
    editor,
    createdAt,
  );
}

describe('fluxo editorial', () => {
  it('cria rascunho normalizado com primeiro evento auditável', () => {
    const request = createEditorialChangeRequest(
      {
        id: ' cr-001 ',
        entityType: 'dashboard',
        entityId: ' painel-principal ',
        title: ' Novo painel ',
        proposedChanges: { url: 'https://example.test' },
      },
      editor,
      createdAt,
    );

    expect(request).toMatchObject({
      id: 'cr-001',
      entityId: 'painel-principal',
      title: 'Novo painel',
      status: 'draft',
      revision: 1,
      createdBy: 'editor-1',
    });
    expect(request.events).toEqual([
      expect.objectContaining({
        id: 'cr-001:1:created',
        sequence: 1,
        action: 'created',
        from: null,
        to: 'draft',
      }),
    ]);
    expect(validateEditorialChangeRequest(request)).toEqual({ valid: true, errors: [] });
  });

  it('executa submissão e aprovação com histórico imutável e justificativa', () => {
    const draft = makeDraft();
    const submitted = transitionEditorialChangeRequest(
      draft,
      { to: 'pending' },
      editor,
      '2026-10-05T18:01:00.000Z',
    );
    const approved = transitionEditorialChangeRequest(
      submitted.request,
      { to: 'approved', justification: '  Conferido com o catálogo oficial.  ' },
      admin,
      '2026-10-05T18:02:00.000Z',
    );

    expect(draft.status).toBe('draft');
    expect(draft.events).toHaveLength(1);
    expect(approved.request).toMatchObject({ status: 'approved', revision: 3 });
    expect(approved.event).toMatchObject({
      id: 'cr-001:3:approved',
      action: 'approved',
      actorId: 'admin-1',
      justification: 'Conferido com o catálogo oficial.',
    });
    expect(validateEditorialChangeRequest(approved.request).valid).toBe(true);
  });

  it('permite rejeitar e reabrir para revisão pelo editor responsável', () => {
    const submitted = transitionEditorialChangeRequest(
      makeDraft(),
      { to: 'pending' },
      editor,
      '2026-10-05T18:01:00.000Z',
    ).request;
    const rejected = transitionEditorialChangeRequest(
      submitted,
      { to: 'rejected', justification: 'A fonte dos dados precisa ser identificada.' },
      admin,
      '2026-10-05T18:02:00.000Z',
    ).request;
    const reopened = transitionEditorialChangeRequest(
      rejected,
      { to: 'draft' },
      editor,
      '2026-10-05T18:03:00.000Z',
    ).request;

    expect(reopened.status).toBe('draft');
    expect(reopened.events.at(-1)?.action).toBe('reopened');
    expect(reopened.revision).toBe(4);
  });

  it('restringe aprovação e rejeição a administradores', () => {
    const pending = transitionEditorialChangeRequest(
      makeDraft(),
      { to: 'pending' },
      editor,
      '2026-10-05T18:01:00.000Z',
    ).request;

    expect(() =>
      transitionEditorialChangeRequest(
        pending,
        { to: 'approved', justification: 'Tudo certo.' },
        editor,
        '2026-10-05T18:02:00.000Z',
      ),
    ).toThrowError(expect.objectContaining({ code: 'UNAUTHORIZED' }));
  });

  it('impede editor de movimentar pedido criado por outro editor', () => {
    expect(() =>
      transitionEditorialChangeRequest(
        makeDraft(),
        { to: 'pending' },
        otherEditor,
        '2026-10-05T18:01:00.000Z',
      ),
    ).toThrowError(expect.objectContaining({ code: 'UNAUTHORIZED' }));
  });

  it.each(['approved', 'rejected'] as const)(
    'exige justificativa não vazia para estado %s',
    (status) => {
      const pending = transitionEditorialChangeRequest(
        makeDraft(),
        { to: 'pending' },
        editor,
        '2026-10-05T18:01:00.000Z',
      ).request;

      expect(() =>
        transitionEditorialChangeRequest(
          pending,
          { to: status, justification: '   ' },
          admin,
          '2026-10-05T18:02:00.000Z',
        ),
      ).toThrowError(expect.objectContaining({ code: 'JUSTIFICATION_REQUIRED' }));
    },
  );

  it('rejeita transições inexistentes e estados terminais', () => {
    expect(() =>
      transitionEditorialChangeRequest(
        makeDraft(),
        { to: 'approved', justification: 'Atalho indevido.' },
        admin,
        '2026-10-05T18:01:00.000Z',
      ),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_TRANSITION' }));

    const cancelled = transitionEditorialChangeRequest(
      makeDraft(),
      { to: 'cancelled' },
      editor,
      '2026-10-05T18:01:00.000Z',
    ).request;
    expect(() =>
      transitionEditorialChangeRequest(
        cancelled,
        { to: 'draft' },
        admin,
        '2026-10-05T18:02:00.000Z',
      ),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_TRANSITION' }));
  });

  it('rejeita alterações vazias, não serializáveis ou com ciclos', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    for (const proposedChanges of [{}, { value: Number.NaN }, cyclic]) {
      expect(() =>
        createEditorialChangeRequest(
          {
            id: 'cr-invalid',
            entityType: 'publication',
            entityId: 'pub-1',
            title: 'Alteração inválida',
            proposedChanges,
          },
          editor,
          createdAt,
        ),
      ).toThrowError(EditorialDomainError);
    }
  });

  it('impede regressão temporal e detecta histórico adulterado', () => {
    const draft = makeDraft();

    expect(() =>
      transitionEditorialChangeRequest(
        draft,
        { to: 'pending' },
        editor,
        '2026-10-05T17:59:59.000Z',
      ),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_TIMESTAMP' }));

    const tampered = {
      ...draft,
      status: 'pending' as const,
    };
    const validation = validateEditorialChangeRequest(tampered);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('O último evento não corresponde ao estado atual.');
  });

  it('detecta ação, identificador e autoridade adulterados no histórico', () => {
    const pending = transitionEditorialChangeRequest(
      makeDraft(),
      { to: 'pending' },
      editor,
      '2026-10-05T18:01:00.000Z',
    ).request;
    const forged = {
      ...pending,
      status: 'approved' as const,
      revision: 3,
      updatedAt: '2026-10-05T18:02:00.000Z',
      events: [
        ...pending.events,
        {
          id: 'evento-forjado',
          sequence: 3,
          action: 'submitted' as const,
          from: 'pending' as const,
          to: 'approved' as const,
          actorId: 'editor-1',
          actorRole: 'editor' as const,
          occurredAt: '2026-10-05T18:02:00.000Z',
          justification: 'Aprovação forjada.',
        },
      ],
    };

    const result = validateEditorialChangeRequest(forged);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Decisão administrativa inválida no evento 3.',
        'Ação incompatível com a transição no evento 3.',
        'Identificador inválido no evento 3.',
      ]),
    );
  });
});
