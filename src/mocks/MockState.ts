import { ACCOUNTS, FIELD_LIMITS, type FixtureAccount } from './fixtures/people';
import { createWorld, type FixtureWorld } from './fixtures/world';

const COOKIE_NAME = 'insumap_mock_rt';

/**
 * Mutable state behind the mock API: the fixture world, issued tokens and the simulated refresh
 * cookie. The cookie holds only a fictitious account id; it stands in for the HttpOnly refresh
 * cookie of the real API so a reload keeps the fixture session.
 */
export class MockState {
  world: FixtureWorld = createWorld();
  readonly accessTokens = new Map<string, { accountId: string; enrollmentOnly: boolean }>();
  readonly challenges = new Map<string, { accountId: string; attempts: number }>();
  readonly mfaEnabled = new Map<string, boolean>();
  limits: Record<string, number> = { ...FIELD_LIMITS };
  private counter = 0;
  private memoryCookie: string | null = null;

  constructor() {
    this.reset();
  }

  reset(now: Date = new Date()): void {
    this.world = createWorld(now);
    this.accessTokens.clear();
    this.challenges.clear();
    this.limits = { ...FIELD_LIMITS };
    this.mfaEnabled.clear();
    for (const account of ACCOUNTS) this.mfaEnabled.set(account.id, account.mfaEnabled);
    this.counter = 0;
    this.setRefreshCookie(null);
  }

  accountByEmail(email: string): FixtureAccount | undefined {
    const normalized = email.normalize('NFKC').trim().toLowerCase();
    return ACCOUNTS.find((account) => account.email === normalized);
  }

  accountById(id: string): FixtureAccount | undefined {
    return ACCOUNTS.find((account) => account.id === id);
  }

  issueAccessToken(accountId: string, enrollmentOnly = false): string {
    this.counter += 1;
    const token = `mock-access-${String(this.counter)}`;
    this.accessTokens.set(token, { accountId, enrollmentOnly });
    return token;
  }

  issueChallenge(accountId: string): string {
    this.counter += 1;
    const token = `mock-challenge-${String(this.counter)}`;
    this.challenges.set(token, { accountId, attempts: 0 });
    return token;
  }

  getRefreshCookie(): string | null {
    if (typeof document === 'undefined') return this.memoryCookie;
    const match = new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`).exec(document.cookie);
    return match?.[1] ?? null;
  }

  setRefreshCookie(accountId: string | null): void {
    this.memoryCookie = accountId;
    if (typeof document === 'undefined') return;
    document.cookie =
      accountId === null
        ? `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Strict`
        : `${COOKIE_NAME}=${accountId}; path=/; SameSite=Strict`;
  }
}

/** Singleton the handlers and the tests share. */
export const mockState = new MockState();
