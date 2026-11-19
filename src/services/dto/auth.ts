import { z } from 'zod';
import { roleSchema, uuid } from './common';

/** `POST /auth/login` (API.md 2.3). Staff get a challenge, patients a full session. */
export const loginResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('AUTHENTICATED'), access_token: z.string() }),
  z.object({ status: z.literal('MFA_CHALLENGE'), challenge_token: z.string() }),
  z.object({ status: z.literal('MFA_ENROLLMENT_REQUIRED'), access_token: z.string() }),
]);
export type LoginResponseDto = z.infer<typeof loginResponseSchema>;

/** `POST /auth/mfa/verify`, `/auth/refresh`. */
export const sessionTokenSchema = z.object({
  status: z.literal('AUTHENTICATED').optional(),
  access_token: z.string(),
});
export type SessionTokenDto = z.infer<typeof sessionTokenSchema>;

export const mfaEnrollmentSchema = z.object({ secret: z.string(), otpauth_uri: z.string() });

/** `POST /auth/mfa/enrollment/confirm`: the codes are shown once. */
export const mfaConfirmSchema = z.object({
  status: z.literal('AUTHENTICATED'),
  access_token: z.string(),
  recovery_codes: z.array(z.string()),
});

export const currentUserSchema = z.object({
  user: z.object({ id: uuid, email: z.string(), full_name: z.string() }),
  role: roleSchema,
  clinic: z
    .object({
      id: uuid,
      name: z.string(),
      is_demo: z.boolean().default(false),
      simulated: z.boolean().default(false),
    })
    .nullable(),
  permissions: z.array(z.string()),
  mfa_enabled: z.boolean(),
  consent_required: z.boolean(),
});
export type CurrentUserDto = z.infer<typeof currentUserSchema>;

export const activationVerifySchema = z.object({
  activation_token: z.string(),
  clinic_name: z.string(),
  privacy_notice_version_id: z.string(),
  email_required: z.boolean(),
});

export const activationCompleteSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('AUTHENTICATED'), access_token: z.string() }),
  z.object({ status: z.literal('MFA_ENROLLMENT_REQUIRED'), access_token: z.string() }),
]);
