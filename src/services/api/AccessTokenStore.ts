/**
 * Holds the access token in memory only (API.md 2.2, AGENTS.md 3.3): never in localStorage,
 * sessionStorage, IndexedDB or cookies. A reload loses it; the refresh cookie restores it.
 */
export class AccessTokenStore {
  private token: string | null = null;
  private readonly listeners = new Set<(token: string | null) => void>();

  get(): string | null {
    return this.token;
  }

  set(token: string): void {
    this.token = token;
    this.emit();
  }

  clear(): void {
    if (this.token === null) return;
    this.token = null;
    this.emit();
  }

  subscribe(listener: (token: string | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.token);
  }
}
