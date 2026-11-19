import { describe, expect, it } from 'vitest';
import { FIELD_LIMITS } from '@/mocks/fixtures/people';
import { buildFormSchemas, LIMIT_KEYS, toFieldErrors } from './formSchemas';

describe('buildFormSchemas', () => {
  const limits = { ...FIELD_LIMITS, [LIMIT_KEYS.emailMax]: 20, [LIMIT_KEYS.passwordMin]: 8, [LIMIT_KEYS.reasonMin]: 10 };
  const schemas = buildFormSchemas(limits);

  it('takes the email length from the limits it receives', () => {
    expect(schemas.email.safeParse('ana@example.test').success).toBe(true);
    const tooLong = schemas.email.safeParse('nombre.largo.largo@example.test');
    expect(tooLong.success).toBe(false);
    expect(tooLong.error?.issues[0]?.message).toBe('Usa máximo 20 caracteres.');
  });

  it('rejects malformed emails and empty required fields in Spanish', () => {
    expect(schemas.email.safeParse('sin-arroba').error?.issues[0]?.message).toMatch(/correo válido/);
    const login = schemas.login.safeParse({ email: '', password: '' });
    expect(toFieldErrors(login.error as never)).toEqual({
      email: 'Completa este campo.',
      password: 'Completa este campo.',
    });
  });

  it('applies the password minimum and the reason bounds from the API', () => {
    expect(schemas.newPassword.safeParse('1234567').error?.issues[0]?.message).toBe('Usa mínimo 8 caracteres.');
    expect(schemas.newPassword.safeParse('12345678').success).toBe(true);
    expect(schemas.reason.safeParse('corto').success).toBe(false);
    expect(schemas.reason.safeParse('x'.repeat(FIELD_LIMITS['reason_max_length'] ?? 0)).success).toBe(true);
    expect(schemas.reason.safeParse('x'.repeat((FIELD_LIMITS['reason_max_length'] ?? 0) + 1)).success).toBe(false);
  });

  it('adds no length rule for a limit the API does not send', () => {
    const open = buildFormSchemas({});
    expect(open.reason.safeParse('x'.repeat(5000)).success).toBe(true);
    expect(open.note.safeParse('x'.repeat(5000)).success).toBe(true);
    expect(open.reason.safeParse('').success).toBe(false);
  });
});
