import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import type { InjectionReasonCode, InjectionSitesDto, InsulinKind, NeedleNote, SiteCode } from '@/services/dto/injection';
import type { InsulinDoseCreateDto } from '@/services/dto/injection';
import type { InjectionSiteEntry } from '@/ui/body';
import { relativeTime } from '../patientFormat';

/** The sites of a suggestion response, as the body map reads them, with the last use in text. */
export function sitesToEntries(data: InjectionSitesDto, now: Date): InjectionSiteEntry[] {
  return data.sites.map((site) => ({
    site: site.site,
    state: site.state,
    lastSpot: site.last_spot,
    lastUsedLabel: site.last_used_at ? relativeTime(new Date(site.last_used_at), now) : undefined,
  }));
}

/** "Hoy: abdomen izquierdo, punto 2", the one sentence the patient reads first. */
export function todayText(site: SiteCode, spot: number): string {
  return format(es.patient.injection.today, { site: es.patient.injection.siteNames[site], spot });
}

/** Plain-language reasons for a suggestion. */
export function reasonTexts(codes: readonly InjectionReasonCode[]): string[] {
  return codes.map((code) => es.patient.injection.reasons[code]);
}

export function needleText(note: NeedleNote): string {
  return es.patient.injection.needle[note];
}

/** Kinds the patient can register, in the order of the screen. */
export const RECORDABLE_KINDS = ['BOLUS', 'BASAL', 'CORRECTION'] as const satisfies readonly InsulinKind[];
export type RecordableKind = (typeof RECORDABLE_KINDS)[number];

/** Parses the units the patient typed: a positive number with at most two decimals (comma or dot). */
export function parseUnits(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 ? value : null;
}

/**
 * Body of the insulin dose. The field names are the DTO's (`InsulinDoseCreateDto`), so a rename in
 * the contract changes this one place. Units come from the patient's typing, never from the app.
 */
export function buildDoseBody(input: {
  readonly kind: RecordableKind;
  readonly units: number;
  readonly administeredAt: string;
  readonly site: SiteCode;
  readonly spot: number;
}): InsulinDoseCreateDto {
  return {
    kind: input.kind,
    units: input.units,
    administered_at: input.administeredAt,
    injection_site: input.site,
    injection_spot: input.spot,
  };
}
