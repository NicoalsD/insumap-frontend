import type { InsumapApi } from '../api/InsumapApi';

export const DEMO_ROLES = ['DOCTOR', 'PATIENT', 'CLINIC_ADMIN'] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

/** True when the build runs against Mock Service Worker (`VITE_USE_MOCKS=true`). */
export function mocksEnabled(flag: string | undefined = import.meta.env.VITE_USE_MOCKS): boolean {
  return flag === 'true';
}

/**
 * Enters the demo as one role: it drives the real login flow (`POST /auth/login`, then
 * `POST /auth/mfa/verify` for staff) with the fixture credentials of that role, so the session
 * comes out of the same code path as a real one. Fixtures load on demand and only when mocks are on.
 */
export class DemoLogin {
  constructor(private readonly api: InsumapApi) {}

  async signIn(role: DemoRole): Promise<void> {
    const { ACCOUNTS, DEMO_TOTP_CODE } = await import('@/mocks/fixtures/people');
    const account = ACCOUNTS.find((candidate) => candidate.role === role && candidate.mfaEnabled === (role !== 'PATIENT'));
    if (!account) throw new Error(`No demo account for role ${role}`);
    const response = await this.api.login(account.email, account.password);
    if (response.status === 'MFA_CHALLENGE') {
      await this.api.verifyMfa(response.challenge_token, DEMO_TOTP_CODE);
    }
  }
}
