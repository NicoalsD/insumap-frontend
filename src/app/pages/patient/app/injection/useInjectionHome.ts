import { useMemo, useState } from 'react';
import type { InsulinKind } from '@/services/dto/injection';
import type { BodyView, InjectionSiteEntry, SiteCode } from '@/ui/body';
import { useInjectionSites } from './injectionQueries';
import { sitesToEntries } from './injectionModel';
import { useNow } from '../useNow';

/** The kinds the home offers: the two the patient uses every day. */
export const HOME_KINDS = ['BOLUS', 'BASAL'] as const satisfies readonly InsulinKind[];
export type HomeKind = (typeof HOME_KINDS)[number];

interface Choice {
  readonly site: SiteCode;
  readonly spot: number;
}

/** What the stage and the inspector share: the kind, the API suggestion and the patient's choice. */
export interface InjectionHome {
  readonly kind: HomeKind;
  readonly setKind: (kind: HomeKind) => void;
  readonly query: ReturnType<typeof useInjectionSites>;
  readonly entries: readonly InjectionSiteEntry[];
  /** The site on the body: the patient's choice, else the suggestion. */
  readonly shown: Choice | null;
  /** True when the patient picked something other than the suggestion. */
  readonly chosenOther: boolean;
  readonly choose: (site: SiteCode, spot: number) => void;
  readonly backToSuggestion: () => void;
  readonly view: BodyView;
  readonly setView: (view: BodyView) => void;
}

/**
 * State of "Dónde inyectarte" on the home: the body sits in the middle of the page and the words
 * (today's site, the reasons, the legend) in the inspector beside it, so both read one source.
 * A change of kind starts again from that kind's suggestion.
 */
export function useInjectionHome(): InjectionHome {
  const [kind, setKindState] = useState<HomeKind>('BOLUS');
  const [choice, setChoice] = useState<Choice | null>(null);
  const [view, setView] = useState<BodyView>('front');
  const query = useInjectionSites(kind);
  const now = useNow();
  const data = query.data;
  const entries = useMemo(() => (data ? sitesToEntries(data, now) : []), [data, now]);
  const suggestion = data?.suggestion ?? null;
  const shown = choice ?? (suggestion ? { site: suggestion.site, spot: suggestion.spot } : null);
  const chosenOther =
    choice !== null &&
    suggestion !== null &&
    (choice.site !== suggestion.site || choice.spot !== suggestion.spot);
  return {
    kind,
    setKind: (next) => {
      setKindState(next);
      setChoice(null);
      setView('front');
    },
    query,
    entries,
    shown,
    chosenOther,
    choose: (site, spot) => {
      setChoice({ site, spot });
    },
    backToSuggestion: () => {
      setChoice(null);
    },
    view,
    setView,
  };
}
