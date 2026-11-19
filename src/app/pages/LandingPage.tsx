import '@fontsource-variable/bricolage-grotesque/wght.css';
import './landing/landing.css';
import {
  ArrowRight,
  Bell,
  Building2,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Database,
  FileCheck2,
  HeartPulse,
  Info,
  KeyRound,
  Link2,
  ListOrdered,
  Menu,
  Pencil,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stethoscope,
  Ticket,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useState, type SubmitEvent } from 'react';
import { Link } from 'react-router';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { Badge } from '@/ui/shadcn/badge';
import { Button } from '@/ui/shadcn/button';
import { Card, CardDescription, CardTitle } from '@/ui/shadcn/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/shadcn/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/shadcn/tabs';
import { TooltipProvider } from '@/ui/shadcn/tooltip';
import {
  HERO_READING,
  HERO_TIR,
  IMPORT_DEMO,
  PATIENT_READING,
  TRIAGE_ROWS,
} from './landing/art/demoContent';
import { BodyCanvas } from './landing/BodyCanvas';
import { StoryScroll } from './landing/StoryScroll';
import { TirBand } from './landing/TirBand';
import { useFieldValidation } from './landing/useFieldValidation';
import { useLandingMotion } from './landing/useLandingMotion';
import { useResponsiveNav } from './landing/useResponsiveNav';

const L = es.landing;
const CONTACT_ID = 'demostracion';
const LOGIN_PATH = '/login';
const MENU_ID = 'lp-menu';

const SECTIONS = [
  { href: '#producto', label: L.navProduct },
  { href: '#como-funciona', label: L.navHow },
  { href: '#seguridad', label: L.navSecurity },
  { href: '#preguntas', label: L.navFaq },
] as const;

/**
 * Public landing (Persuade): sells Insumap to clinics and hospitals. The primary action is a
 * demo request; signing in lives at `/login`. Landmarks: banner header, main and contentinfo
 * footer, so the skip link and screen reader navigation work as on any page.
 */
export function LandingPage() {
  const scopeRef = useRef<HTMLDivElement>(null);
  useLandingMotion(scopeRef);

  return (
    <TooltipProvider>
      <div ref={scopeRef} className="landing">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="lp-main">
          <Hero />
          <Features />
          <StoryScroll />
          <ProductSection />
          <AiSection />
          <FlowSection />
          <SecuritySection />
          <FaqSection />
          <ContactSection />
        </main>
        <Footer />
      </div>
    </TooltipProvider>
  );
}

function Brand() {
  return (
    <Link to="/" className="lp-brand" aria-label={L.homeLink}>
      <span className="lp-brand__mark" aria-hidden="true">
        <HeartPulse size={20} strokeWidth={2.5} />
      </span>
      <span translate="no">{es.app.name}</span>
    </Link>
  );
}

/**
 * One navigation tree at every width: inline links when the row fits, otherwise a native popover
 * opened by the "Menú" button. The row is measured, not guessed from a breakpoint.
 */
function SiteHeader() {
  const headerRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  useResponsiveNav(headerRef, rowRef, menuRef);

  const closeMenu = () => {
    const menu = menuRef.current;
    if (menu?.matches(':popover-open')) menu.hidePopover();
  };

  return (
    <header ref={headerRef} className="lp-header">
      <div ref={rowRef} className="lp-section lp-header__row">
        <Brand />
        <nav className="lp-nav" aria-label={L.pageNav}>
          <button
            type="button"
            className="lp-menu-button"
            popoverTarget={MENU_ID}
            aria-controls={MENU_ID}
          >
            <Menu size={20} aria-hidden="true" />
            <span>{L.menu}</span>
          </button>
          <ul ref={menuRef} id={MENU_ID} className="lp-menu" popover="auto">
            {SECTIONS.map((section) => (
              <li key={section.href}>
                <a href={section.href} onClick={closeMenu}>
                  {section.label}
                </a>
              </li>
            ))}
            <li className="lp-menu__extra">
              <Link to={LOGIN_PATH}>{L.login}</Link>
            </li>
            <li className="lp-menu__extra lp-menu__cta">
              <a href={`#${CONTACT_ID}`} onClick={closeMenu}>
                {L.requestDemo}
              </a>
            </li>
          </ul>
        </nav>
        <div className="lp-header__actions">
          <Button asChild variant="ghost" size="sm" className="lp-header__login">
            <Link to={LOGIN_PATH}>{L.login}</Link>
          </Button>
          <Button asChild size="sm" className="lp-header__cta">
            <a href={`#${CONTACT_ID}`}>{L.requestDemo}</a>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <div className="lp-zone lp-hero-zone">
      <section className="lp-section lp-hero" aria-labelledby="lp-title">
        <div className="lp-hero__copy">
          <h1 id="lp-title" className="lp-hero__title" data-hero-rise>
            {L.title}
          </h1>
          <p className="lp-hero__lead" data-hero-rise>
            {L.lead}
          </p>
          <div className="lp-hero__actions" data-hero-rise>
            <Button asChild size="lg">
              <a href={`#${CONTACT_ID}`}>
                {L.requestDemo}
                <ArrowRight aria-hidden="true" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#como-funciona">{L.seeHow}</a>
            </Button>
          </div>
          <ul className="lp-hero__facts" aria-label={L.heroFactsLabel} data-hero-rise>
            {L.heroFacts.map((fact) => (
              <li key={fact}>
                <Check size={18} strokeWidth={2.75} aria-hidden="true" />
                {fact}
              </li>
            ))}
          </ul>
        </div>

        <div className="lp-hero__stage">
          <BodyCanvas mode="hero" label={L.scene.label} className="lp-hero__canvas" />
          <div className="lp-chip lp-chip--reading">
            <span className="lp-chip__label">{L.chips.readingLabel}</span>
            <span className="lp-measure">
              <span className="lp-measure__value">{HERO_READING.valueMgDl}</span>
              <span className="lp-measure__unit">{es.glucose.unit}</span>
            </span>
            <span className="lp-state" data-state={HERO_READING.state}>
              {es.glucose.ranges[HERO_READING.state]}
            </span>
          </div>
          <div className="lp-chip lp-chip--tir">
            <span className="lp-chip__label">{L.chips.tirLabel}</span>
            <TirBand segments={HERO_TIR} label={L.chips.tirLabel} showLegend />
          </div>
        </div>
      </section>
    </div>
  );
}

const FEATURE_ICONS: readonly LucideIcon[] = [ListOrdered, Smartphone, Bell, Sparkles];
const FEATURE_TONES = ['mint', 'sun', 'bubble', 'cobalt'] as const;

function Features() {
  return (
    <section className="lp-zone lp-zone--white" aria-label={L.features.label}>
      <ul className="lp-section lp-features" data-reveal-group>
        {L.features.items.map((item, index) => {
          const Icon = FEATURE_ICONS[index] ?? Sparkles;
          return (
            <li
              key={item.title}
              className="lp-feature"
              data-tone={FEATURE_TONES[index]}
              data-reveal
            >
              <Card className="h-full">
                <span className="lp-feature__icon" aria-hidden="true">
                  <Icon size={22} strokeWidth={2.25} />
                </span>
                <CardTitle as="h2">{item.title}</CardTitle>
                <CardDescription>{item.text}</CardDescription>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SectionHead({ id, title, lead }: { id: string; title: string; lead?: string }) {
  return (
    <div className="lp-section__head">
      <h2 id={id} className="lp-section__title" data-reveal>
        {title}
      </h2>
      {lead ? (
        <p className="lp-section__lead" data-reveal>
          {lead}
        </p>
      ) : null}
    </div>
  );
}

function Points({ items }: { items: readonly string[] }) {
  return (
    <ul className="lp-points">
      {items.map((item) => (
        <li key={item}>
          <Check size={20} strokeWidth={2.75} aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const PRODUCT_TABS = [
  { value: 'doctor', icon: Stethoscope },
  { value: 'patient', icon: Smartphone },
  { value: 'clinic', icon: Building2 },
] as const;

function ProductSection() {
  const P = L.product;
  const titles = { doctor: P.doctorTitle, patient: P.patientTitle, clinic: P.adminTitle };
  const points = { doctor: P.doctorPoints, patient: P.patientPoints, clinic: P.adminPoints };
  const captions = { doctor: P.doctorCaption, patient: P.patientCaption, clinic: P.clinicCaption };
  const mocks = { doctor: <TriageMock />, patient: <PatientMock />, clinic: <ImportMock /> };
  return (
    <section id="producto" className="lp-zone" aria-labelledby="lp-product-title" data-reveal-group>
      <div className="lp-section">
        <SectionHead id="lp-product-title" title={P.title} lead={P.lead} />
        <Tabs defaultValue="doctor" data-reveal>
          <TabsList aria-label={P.tabsLabel}>
            {PRODUCT_TABS.map(({ value, icon: Icon }) => (
              <TabsTrigger key={value} value={value}>
                <Icon aria-hidden="true" />
                {titles[value]}
              </TabsTrigger>
            ))}
          </TabsList>
          {PRODUCT_TABS.map(({ value }) => (
            <TabsContent key={value} value={value} className="lp-panel">
              <div className="lp-panel__copy">
                <h3 className="lp-panel__title">{titles[value]}</h3>
                <Points items={points[value]} />
              </div>
              <figure className="lp-panel__mock">
                {mocks[value]}
                <figcaption className="lp-mock__caption">{captions[value]}</figcaption>
              </figure>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}

function TriageMock() {
  const P = L.product;
  return (
    <div className="lp-mock">
      <p className="lp-mock__bar">{es.nav.triage}</p>
      {/* Narrow screens scroll the table sideways; the region is focusable so keyboards can too. */}
      <div className="lp-table-scroll" role="region" aria-label={P.tableCaption} tabIndex={0}>
        <table className="lp-table">
          <caption>{P.tableCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{P.colPatient}</th>
              <th scope="col">{P.colTir}</th>
              <th scope="col">{P.colLast}</th>
            </tr>
          </thead>
          <tbody>
            {TRIAGE_ROWS.map((row) => (
              <tr key={row.name}>
                <td>
                  {row.name}
                  <span className="lp-table__reason">{row.reason}</span>
                </td>
                <td className="lp-table__band">
                  <TirBand segments={row.tir} label={`${P.colTir}: ${row.name}`} showLegend />
                </td>
                <td>
                  <span className="lp-table__last">
                    <span className="lp-measure">
                      <span className="font-bold">{row.lastMgDl}</span>
                      <span className="lp-measure__unit">{es.glucose.unit}</span>
                    </span>
                    <span className="lp-state" data-state={row.lastState}>
                      {es.glucose.ranges[row.lastState]}
                    </span>
                    <span className="lp-table__ago">{format(P.lastAt, { time: row.lastAgo })}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PatientMock() {
  const P = L.product;
  return (
    <div className="lp-mock">
      <p className="lp-mock__bar">
        <span>{P.patientLast}</span>
        <span className="lp-state" data-state={PATIENT_READING.state}>
          {es.glucose.ranges[PATIENT_READING.state]}
        </span>
      </p>
      <p className="lp-measure">
        <span className="lp-measure__value">{PATIENT_READING.valueMgDl}</span>
        <span className="lp-measure__unit">{es.glucose.unit}</span>
      </p>
      <p className="font-semibold">{P.patientStepLabel}</p>
      <ol className="lp-stepper" aria-label={P.stepsLabel}>
        {P.patientSteps.map((step, index) => (
          <li key={step} data-current={index === 0 || undefined}>
            <span className="lp-stepper__number" aria-hidden="true">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ImportMock() {
  const P = L.product;
  return (
    <div className="lp-mock">
      <p className="lp-mock__bar">
        <span className="lp-file inline-flex items-center gap-2">
          <FileCheck2 size={18} aria-hidden="true" />
          {P.importFile}
        </span>
      </p>
      <p className="lp-import-row" data-tone="ok">
        <CircleCheck size={20} aria-hidden="true" />
        {format(P.importOk, { count: IMPORT_DEMO.validRows })}
      </p>
      <p className="lp-import-row" data-tone="error">
        <CircleAlert size={20} aria-hidden="true" />
        {format(P.importError, { count: IMPORT_DEMO.errorRows })}
      </p>
      <p className="lp-next-step">
        <Ticket size={18} aria-hidden="true" />
        {P.importNext}
      </p>
    </div>
  );
}

const DECISIONS: readonly { kind: string; icon: LucideIcon; title: string; text: string }[] = [
  { kind: 'approve', icon: Check, title: L.ai.approve, text: L.ai.approveText },
  { kind: 'modify', icon: Pencil, title: L.ai.modify, text: L.ai.modifyText },
  { kind: 'reject', icon: X, title: L.ai.reject, text: L.ai.rejectText },
];

function AiSection() {
  return (
    <section className="lp-zone lp-zone--white" aria-labelledby="lp-ai-title" data-reveal-group>
      <div className="lp-section">
        <SectionHead id="lp-ai-title" title={L.ai.title} lead={L.ai.lead} />
        <div className="lp-ai">
          <div className="lp-decisions" role="group" aria-label={L.ai.decisionsLabel}>
            {DECISIONS.map(({ kind, icon: Icon, title, text }) => (
              <details key={kind} className="lp-decision" data-kind={kind} data-reveal open>
                <summary>
                  <span className="lp-decision__icon" aria-hidden="true">
                    <Icon size={20} strokeWidth={2.75} />
                  </span>
                  {title}
                  <ChevronDown className="lp-decision__chevron" size={22} aria-hidden="true" />
                </summary>
                <p>{text}</p>
              </details>
            ))}
          </div>
          <aside className="lp-suggestion" aria-label={es.notices.aiSuggestion} data-reveal>
            <Badge variant="pending" className="whitespace-normal bg-white/10 text-white">
              <Sparkles aria-hidden="true" />
              {es.notices.aiSuggestion}
            </Badge>
            <p className="lp-suggestion__who">{L.ai.cardPatient}</p>
            <p className="lp-suggestion__reason">{L.ai.cardReason}</p>
            <p className="lp-suggestion__proposal">{L.ai.cardProposal}</p>
            <p className="lp-suggestion__note">
              <ShieldCheck size={18} aria-hidden="true" className="shrink-0" />
              {L.ai.patientNever}
            </p>
            <p className="lp-suggestion__note">
              <Info size={18} aria-hidden="true" className="shrink-0" />
              {L.notice}
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}

const FLOW_ICONS: readonly LucideIcon[] = [Upload, Ticket, Smartphone, ListOrdered];

function FlowSection() {
  const [beforeTerm, afterTerm] = L.flow.steps[0].text.split('{fhir}');
  return (
    <section className="lp-zone" aria-labelledby="lp-flow-title" data-reveal-group>
      <div className="lp-section">
        <SectionHead id="lp-flow-title" title={L.flow.title} lead={L.flow.lead} />
        <div className="lp-flow-track">
          <div className="lp-flow__line" aria-hidden="true" />
          <ol className="lp-flow">
            {L.flow.steps.map((step, index) => {
              const Icon = FLOW_ICONS[index] ?? Upload;
              return (
                <li key={step.title} className="lp-flow__step" data-reveal>
                  <span className="lp-flow__dot" aria-hidden="true">
                    <Icon size={22} strokeWidth={2.25} />
                  </span>
                  <h3 className="lp-flow__title">{step.title}</h3>
                  <p className="lp-flow__text">
                    {index === 0 ? (
                      <>
                        {beforeTerm}
                        <Popover>
                          <PopoverTrigger asChild>
                            <button type="button" className="lp-term">
                              {L.flow.fhirTerm}
                              <Info size={15} strokeWidth={2.5} aria-hidden="true" />
                              <span className="visually-hidden">{`, ${L.flow.fhirMore}`}</span>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent side="top">{L.flow.fhirHelp}</PopoverContent>
                        </Popover>
                        {afterTerm}
                      </>
                    ) : (
                      step.text
                    )}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

const SECURITY_ICONS: readonly LucideIcon[] = [KeyRound, ShieldCheck, Database, Link2, FileCheck2];

/** Security as a ruled list beside its heading: five facts read as one argument, not five cards. */
function SecuritySection() {
  return (
    <section
      id="seguridad"
      className="lp-zone lp-zone--night"
      aria-labelledby="lp-security-title"
      data-reveal-group
    >
      <div className="lp-section lp-security">
        <SectionHead id="lp-security-title" title={L.security.title} lead={L.security.lead} />
        <ul className="lp-security__list">
          {L.security.items.map((item, index) => {
            const Icon = SECURITY_ICONS[index] ?? ShieldCheck;
            return (
              <li key={item.title} className="lp-security__item" data-reveal>
                <span className="lp-security__icon" aria-hidden="true">
                  <Icon size={22} strokeWidth={2.25} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section
      id="preguntas"
      className="lp-zone lp-zone--white"
      aria-labelledby="lp-faq-title"
      data-reveal-group
    >
      <div className="lp-section lp-faq">
        <SectionHead id="lp-faq-title" title={L.faq.title} />
        <div className="lp-faq__list">
          {L.faq.items.map((item) => (
            <details key={item.question} className="lp-decision lp-faq__item" data-reveal>
              <summary>
                {item.question}
                <ChevronDown className="lp-decision__chevron" size={22} aria-hidden="true" />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

type ContactStatus = 'idle' | 'sent' | 'unavailable';

function ContactSection() {
  const C = L.contact;
  const salesEmail = import.meta.env.VITE_SALES_EMAIL;
  const [status, setStatus] = useState<ContactStatus>('idle');
  const validation = useFieldValidation();

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!salesEmail) {
      setStatus('unavailable');
      return;
    }
    const data = new FormData(event.currentTarget);
    const field = (name: string): string => {
      const value = data.get(name);
      return typeof value === 'string' ? value.trim() : '';
    };
    const body = format(C.body, {
      name: field('name'),
      organization: field('organization'),
      email: field('email'),
      jobTitle: field('jobTitle'),
      patients: field('patients'),
    });
    const query = new URLSearchParams({ subject: C.subject, body })
      .toString()
      .replaceAll('+', '%20');
    window.location.href = `mailto:${salesEmail}?${query}`;
    setStatus('sent');
  };

  const statusText: Record<ContactStatus, string> = {
    idle: '',
    sent: C.sent,
    unavailable: C.unavailable,
  };

  return (
    <section
      id={CONTACT_ID}
      className="lp-zone lp-zone--cobalt"
      aria-labelledby="lp-contact-title"
      data-reveal-group
    >
      <div className="lp-section lp-contact">
        <div className="lp-contact__copy">
          <h2 id="lp-contact-title" className="lp-section__title" data-reveal>
            {C.title}
          </h2>
          <p className="lp-section__lead" data-reveal>
            {C.lead}
          </p>
        </div>
        <form className="lp-form" onSubmit={submit} {...validation.formProps} data-reveal>
          <ContactField name="name" label={C.name} error={C.nameError} autoComplete="name" />
          <ContactField
            name="organization"
            label={C.organization}
            error={C.organizationError}
            autoComplete="organization"
          />
          <ContactField
            name="email"
            label={C.email}
            error={C.emailError}
            autoComplete="email"
            type="email"
            placeholder={`${C.emailHint}…`}
          />
          <ContactField
            name="jobTitle"
            label={C.jobTitle}
            error={C.jobTitleError}
            autoComplete="organization-title"
          />
          <ContactField
            name="patients"
            label={C.patients}
            error={C.patientsError}
            autoComplete="off"
            inputMode="numeric"
            pattern="[0-9]*"
            optional
            wide
          />
          <Button type="submit" size="lg" className="lp-form__submit">
            {C.submit}
            <ArrowRight aria-hidden="true" />
          </Button>
          <p className="lp-form__status" role="status">
            {statusText[status]}
          </p>
          <p className="visually-hidden" aria-live="polite">
            {validation.announcement}
          </p>
        </form>
      </div>
    </section>
  );
}

interface ContactFieldProps {
  name: string;
  label: string;
  error: string;
  autoComplete: string;
  type?: string;
  placeholder?: string;
  inputMode?: 'numeric';
  pattern?: string;
  optional?: boolean;
  wide?: boolean;
}

function ContactField({
  name,
  label,
  error,
  autoComplete,
  type = 'text',
  placeholder,
  inputMode,
  pattern,
  optional = false,
  wide = false,
}: ContactFieldProps) {
  const id = `lp-contact-${name}`;
  const errorId = `${id}-error`;
  return (
    <div className="lp-field" data-wide={wide || undefined}>
      <label htmlFor={id}>
        {label}
        {optional ? <span className="lp-field__optional"> {L.contact.optional}</span> : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        inputMode={inputMode}
        pattern={pattern}
        required={!optional}
        spellCheck={type === 'email' ? false : undefined}
        aria-invalid="false"
        data-error={errorId}
      />
      <p id={errorId} className="lp-field__error">
        <CircleAlert size={16} strokeWidth={2.5} aria-hidden="true" />
        {error}
      </p>
    </div>
  );
}

function Footer() {
  return (
    <footer className="lp-zone lp-zone--ink lp-footer">
      <div className="lp-section lp-footer__grid">
        <div className="lp-footer__brand">
          <Brand />
          <p className="lp-footer__tagline">{es.app.tagline}</p>
        </div>
        <nav aria-label={L.footer.product}>
          <p className="lp-footer__heading">{L.footer.product}</p>
          <ul>
            {SECTIONS.map((section) => (
              <li key={section.href}>
                <a href={section.href}>{section.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={L.footer.company}>
          <p className="lp-footer__heading">{L.footer.company}</p>
          <ul>
            <li>
              <Link to={LOGIN_PATH}>{L.login}</Link>
            </li>
            <li>
              <a href={`#${CONTACT_ID}`}>{L.requestDemo}</a>
            </li>
          </ul>
        </nav>
        <p className="lp-footer__notice">{L.notice}</p>
        <p className="lp-footer__rights">
          {format(L.footer.rights, { year: String(new Date().getFullYear()) })}
        </p>
      </div>
    </footer>
  );
}
