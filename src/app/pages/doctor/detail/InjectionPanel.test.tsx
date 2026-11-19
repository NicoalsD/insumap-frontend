import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { InsulinDoseDto, SiteCode } from '@/services/dto/injection';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { expectNoAxeViolations } from '@/test/axe';
import { InjectionPanel } from './InjectionPanel';
import { PlanPanel } from './CarePanels';
import { PatientHeader } from './PatientHeader';
import { HISTORY_DAYS } from './model/injectionHistory';

const END = new Date('2026-11-19T12:00:00Z');
const HOUR_MS = 3_600_000;

function dose(id: string, hoursBefore: number, site: SiteCode, spot = 1): InsulinDoseDto {
  return {
    id,
    insulin_product_id: null,
    kind: 'BOLUS',
    units: 7,
    administered_at: new Date(END.getTime() - hoursBefore * HOUR_MS).toISOString(),
    treatment_plan_id: null,
    injection_site: site,
    injection_spot: spot,
    simulated: false,
  };
}

describe('InjectionPanel (read-only body map, counts, recent doses, review aid)', () => {
  it('shows the counts per site as text, the recent doses, and passes axe', async () => {
    const doses = [dose('a', 1, 'ABDOMEN_LEFT', 2), dose('b', 30, 'ABDOMEN_LEFT', 3), dose('c', 60, 'THIGH_RIGHT', 1)];
    const { container } = render(<InjectionPanel doses={doses} periodEnd={END} timeZone="America/Bogota" />);
    expect(screen.getByRole('heading', { level: 2, name: es.detail.injection.title })).toBeInTheDocument();
    expect(
      screen.getByText(format(es.detail.injection.siteCount, { site: 'Abdomen izq.', count: 2, days: HISTORY_DAYS })),
    ).toBeInTheDocument();
    expect(
      screen.getByText(format(es.detail.injection.siteCountOne, { site: 'Muslo der.', days: HISTORY_DAYS })),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('.injection-panel__recent li')).toHaveLength(3);
    expect(screen.queryByText(es.detail.injection.concentrationTitle)).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('shows the review aid when one site holds more than 40 % of the doses, as help and not a finding', () => {
    const doses = Array.from({ length: 6 }, (_, i) => dose(`x${String(i)}`, i + 1, 'ABDOMEN_LEFT', 1));
    doses.push(dose('y', 50, 'ARM_LEFT', 1));
    render(<InjectionPanel doses={doses} periodEnd={END} timeZone="America/Bogota" />);
    expect(screen.getByText(es.detail.injection.concentrationTitle)).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('Ayuda de revisión');
    expect(screen.getByRole('note')).toHaveTextContent('No cambia ninguna dosis');
  });

  it('says there are no doses with a site when the history has none', () => {
    render(<InjectionPanel doses={[]} periodEnd={END} timeZone="America/Bogota" />);
    expect(screen.getByText(format(es.detail.injection.siteNone, { days: HISTORY_DAYS }))).toBeInTheDocument();
    expect(screen.getByText(format(es.detail.injection.recentEmpty, { days: HISTORY_DAYS }))).toBeInTheDocument();
  });
});

describe('PlanPanel allowed sites', () => {
  it('shows each insulin item with its allowed sites and the patient note', () => {
    const plan = {
      id: 'p1',
      name: 'Basal-bolo adulto',
      version: 4,
      summary: 'Resumen',
      schedule: [
        { time_of_day: '07:30', label: 'Rápida con el desayuno', dose_units: null, insulin_kind: 'BOLUS', injection_sites: null },
        {
          time_of_day: '22:00',
          label: 'Basal nocturna',
          dose_units: 18,
          insulin_kind: 'BASAL',
          injection_sites: ['THIGH_LEFT', 'THIGH_RIGHT'],
        },
      ],
    };
    render(<PlanPanel plan={plan as never} />);
    expect(screen.getByText('Basal nocturna')).toBeInTheDocument();
    expect(screen.getByText('Muslo')).toBeInTheDocument();
    expect(screen.getByText(es.detail.injection.noRestriction)).toBeInTheDocument();
    expect(screen.getByText(es.detail.plan.sitesNote)).toBeInTheDocument();
  });

  it('says so when the plan carries no insulin items, instead of inventing them', () => {
    render(<PlanPanel plan={{ id: 'p1', name: 'Plan', version: 1, summary: 'Resumen' }} />);
    expect(screen.getByText(es.detail.plan.sitesMissing)).toBeInTheDocument();
  });
});

describe('PatientHeader sex and BMI', () => {
  const base = {
    fullName: 'Paciente de prueba',
    profileLabel: 'Adulto estándar',
    source: null,
    lastReading: null,
    risk: null,
    timeZone: 'America/Bogota',
    pendingSuggestions: 0,
    openAlerts: 0,
  };

  it('shows sex and BMI when the record has them', () => {
    render(<PatientHeader {...base} sex="FEMALE" bmi={23.46} />);
    expect(screen.getByText(es.detail.header.sexFemale)).toBeInTheDocument();
    expect(screen.getByText(format(es.detail.header.bmi, { value: 23.5 }))).toBeInTheDocument();
  });

  it('shows neither when the record does not have them', () => {
    render(<PatientHeader {...base} sex="UNKNOWN" bmi={null} />);
    expect(screen.queryByText(es.detail.header.sex)).not.toBeInTheDocument();
    expect(screen.queryByText(es.detail.header.bmiLabel)).not.toBeInTheDocument();
  });
});
