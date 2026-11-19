import { describe, expect, it } from 'vitest';
import { AccessTokenStore } from '../api/AccessTokenStore';
import { InsumapApi } from '../api/InsumapApi';
import { DemoLogin, DEMO_ROLES, mocksEnabled } from './DemoLogin';

describe('DemoLogin', () => {
  it.each(DEMO_ROLES)('signs in as %s through the real login flow', async (role) => {
    const tokens = new AccessTokenStore();
    const api = new InsumapApi({ tokens });
    await new DemoLogin(api).signIn(role);
    expect(tokens.get()).not.toBeNull();
    const me = await api.getCurrentUser();
    expect(me.role).toBe(role);
    expect(me.clinic?.is_demo).toBe(true);
  });

  it('reads the mocks flag', () => {
    expect(mocksEnabled('true')).toBe(true);
    expect(mocksEnabled('false')).toBe(false);
    expect(mocksEnabled(undefined)).toBe(false);
  });
});
