import { describe, expect, it } from 'vitest';
import { resolveAccessDecision } from './RouteGuards';

describe('resolveAccessDecision', () => {
  it('aguarda a resolução da sessão', () => {
    expect(resolveAccessDecision({ loading: true, hasUser: false, canAccessPlatform: false })).toBe('loading');
  });

  it('envia visitantes sem sessão para o login', () => {
    expect(resolveAccessDecision({ loading: false, hasUser: false, canAccessPlatform: false })).toBe('login');
  });

  it('mantém contas pendentes ou suspensas fora da plataforma', () => {
    expect(resolveAccessDecision({ loading: false, hasUser: true, canAccessPlatform: false })).toBe('account-status');
  });

  it('libera somente contas ativas', () => {
    expect(resolveAccessDecision({ loading: false, hasUser: true, canAccessPlatform: true })).toBe('allow');
  });
});
