import type { PermissionCode, Role } from '@/core/auth/permissions';
import type { CurrentUserDto } from '../dto/auth';
import type { ViewModelAdapter } from './ViewModelAdapter';

export interface SessionViewModel {
  readonly userId: string;
  readonly email: string;
  readonly fullName: string;
  readonly role: Role;
  readonly clinic: { readonly id: string; readonly name: string } | null;
  /** Clinic flag from the contract (API.md 1.2). The UI decides whether to show anything for it. */
  readonly isDemo: boolean;
  readonly mfaEnabled: boolean;
  readonly consentRequired: boolean;
  /** UX only: the server always decides. */
  can(permission: PermissionCode): boolean;
}

/**
 * Session of the signed-in user from `GET /auth/current-user`.
 *
 * Pattern: P06 Adapter
 */
export class SessionViewModelAdapter implements ViewModelAdapter<CurrentUserDto, SessionViewModel> {
  adapt(dto: CurrentUserDto): SessionViewModel {
    const permissions = new Set<string>(dto.permissions);
    return {
      userId: dto.user.id,
      email: dto.user.email,
      fullName: dto.user.full_name,
      role: dto.role,
      clinic: dto.clinic && { id: dto.clinic.id, name: dto.clinic.name },
      isDemo: dto.clinic?.is_demo === true || dto.clinic?.simulated === true,
      mfaEnabled: dto.mfa_enabled,
      consentRequired: dto.consent_required,
      can: (permission) => permissions.has(permission),
    };
  }
}
