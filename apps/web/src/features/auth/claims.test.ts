import { describe, expect, it } from 'vitest';
import { resolveEffectiveAccess } from './claims';

describe('resolveEffectiveAccess', () => {
  it('nega acesso quando não há claims administrativos', () => {
    expect(resolveEffectiveAccess({})).toEqual({
      role: 'user',
      accountStatus: 'pending',
      canAccessPlatform: false,
    });
  });

  it('nega acesso quando as claims são inválidas', () => {
    expect(resolveEffectiveAccess({ role: 'owner', accountStatus: 'enabled' })).toEqual({
      role: 'user',
      accountStatus: 'pending',
      canAccessPlatform: false,
    });
  });

  it('libera uma conta ativa com role reconhecida', () => {
    expect(resolveEffectiveAccess({ role: 'editor', accountStatus: 'active' })).toEqual({
      role: 'editor',
      accountStatus: 'active',
      canAccessPlatform: true,
    });
  });

  it('mantém uma conta suspensa sem acesso', () => {
    expect(resolveEffectiveAccess({ role: 'admin', accountStatus: 'suspended' })).toEqual({
      role: 'admin',
      accountStatus: 'suspended',
      canAccessPlatform: false,
    });
  });
});
