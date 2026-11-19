import { Clock, Pause, Play, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { bodyStrings } from '@/i18n/es.body';
import { format } from '@/i18n/format';
import { Button } from '@/ui/Button';
import './InjectionBodyMap.css';
import {
  asSpot,
  defaultSpotFor,
  isSelectable,
  mapLabels,
  orderEntries,
  type InjectionSiteEntry,
  type MapLabel,
} from './injectionModel';
import { siteView } from './injectionRays';
import type { InjectionScene, InjectionScenePlan } from './injectionScene';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { canRender3D } from './webglSupport';
import {
  BODY_VIEWS,
  SPOT_NUMBERS,
  type BodyView,
  type InjectionState,
  type SiteCode,
  type SpotNumber,
} from './siteCodes';

export interface InjectionBodyMapProps {
  /** The sites with their state from the API. Sites not listed are not shown. */
  readonly sites: readonly InjectionSiteEntry[];
  readonly selectedSite: SiteCode | null;
  readonly selectedSpot: number | null;
  readonly onSelect: (site: SiteCode, spot: SpotNumber) => void;
  /** Controlled view. Omit it to let the map keep its own. */
  readonly view?: BodyView | undefined;
  readonly defaultView?: BodyView | undefined;
  readonly onViewChange?: ((view: BodyView) => void) | undefined;
  /** Accessible name of the site list, supplied by the caller (already in Spanish). */
  readonly label: string;
  /**
   * Show the map without choosing: states, labels and the view switch stay, but the radios and spot
   * choice are off, `onSelect` is never called, and the pointer keeps its normal shape.
   */
  readonly readOnly?: boolean | undefined;
}

/**
 * Where to inject: a translucent 3D body with one marker per site and spot, next to a native radio
 * list with the same sites and states. The list is the operable path (keyboard, screen readers);
 * the 3D map repeats it visually and adds tap targets. Without WebGL only the list is shown.
 */
export function InjectionBodyMap({
  sites,
  selectedSite,
  selectedSpot,
  onSelect,
  view: viewProp,
  defaultView = 'front',
  onViewChange,
  label,
  readOnly = false,
}: InjectionBodyMapProps) {
  const ids = useId();
  const [internalView, setInternalView] = useState<BodyView>(defaultView);
  const view = viewProp ?? internalView;
  const reduced = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(!reduced);
  const [use3D] = useState(canRender3D);
  const [sceneReady, setSceneReady] = useState(false);
  const [stageFailed, setStageFailed] = useState(false);
  const [hoverSite, setHoverSite] = useState<SiteCode | null>(null);
  const [focusSite, setFocusSite] = useState<SiteCode | null>(null);
  const showStage = use3D && !stageFailed;

  const entries = useMemo(() => orderEntries(sites), [sites]);
  const selectedEntry = entries.find((entry) => entry.site === selectedSite);
  const stateBySite = useMemo(
    () => new Map(entries.map((entry) => [entry.site, entry.state] as const)),
    [entries],
  );
  const labels = useMemo(
    () => mapLabels({ entries, selectedSite, selectedSpot, hoverSite, focusSite }),
    [entries, selectedSite, selectedSpot, hoverSite, focusSite],
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<InjectionScene | null>(null);
  const planRef = useRef<InjectionScenePlan | null>(null);
  const onSelectRef = useRef(onSelect);
  const readOnlyRef = useRef(readOnly);
  const suggestedEntry = entries.find((entry) => entry.state === 'SUGGESTED');
  /** A suggested site on the other side: offered as a note while the back is showing. */
  const suggestedOnFront = suggestedEntry !== undefined && siteView(suggestedEntry.site) !== view;

  const changeView = (next: BodyView) => {
    if (next === view) return;
    if (viewProp === undefined) setInternalView(next);
    onViewChange?.(next);
  };

  const chooseSite = (entry: InjectionSiteEntry) => {
    if (readOnly) return;
    changeView(siteView(entry.site));
    onSelect(entry.site, defaultSpotFor(entry));
  };

  const motion = playing && !reduced;
  const plan = useMemo<InjectionScenePlan>(
    () => ({ view, sites: entries, selectedSite, selectedSpot, playing: motion, labels, readOnly }),
    [view, entries, selectedSite, selectedSpot, motion, labels, readOnly],
  );

  useEffect(() => {
    onSelectRef.current = onSelect;
    readOnlyRef.current = readOnly;
  }, [onSelect, readOnly]);

  useEffect(() => {
    planRef.current = plan;
    sceneRef.current?.apply(plan);
  }, [plan]);

  useEffect(() => {
    if (!use3D) return;
    const canvas = canvasRef.current;
    const labelHost = labelsRef.current;
    if (!canvas || !labelHost) return;
    let cancelled = false;
    void Promise.all([
      import('./injectionScene'),
      import('@/app/pages/landing/art/bodyMesh').then(({ loadBodyMesh }) => loadBodyMesh()),
    ])
      .then(([{ createInjectionScene }, mesh]) => {
        if (cancelled) return;
        const scene = createInjectionScene({
          canvas,
          labelHost,
          reducedMotion: reduced,
          mesh,
          onPick: (site, spot) => {
            if (!readOnlyRef.current) onSelectRef.current(site, spot);
          },
          onHover: (site) => {
            setHoverSite(site);
          },
        });
        if (!scene) {
          setStageFailed(true);
          return;
        }
        sceneRef.current = scene;
        if (planRef.current) scene.apply(planRef.current);
        setSceneReady(true);
      })
      .catch(() => {
        if (!cancelled) setStageFailed(true);
      });
    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [use3D, reduced]);

  const siteGroupName = `${ids}-site`;
  const hintId = `${ids}-hint`;
  const spotHintId = `${ids}-spot-hint`;

  return (
    <div className="ibm-host">
      <div className={readOnly ? 'ibm ibm--readonly' : 'ibm'}>
        <div className="ibm__main">
          {showStage ? (
            <>
              <div className="ibm__toolbar">
                <div role="group" aria-label={bodyStrings.viewGroup} className="ibm__views">
                  {BODY_VIEWS.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      size="sm"
                      variant={view === option ? 'primary' : 'secondary'}
                      aria-pressed={view === option}
                      onClick={() => {
                        changeView(option);
                      }}
                    >
                      {bodyStrings.views[option]}
                    </Button>
                  ))}
                </div>
                {reduced ? null : (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    icon={playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                    onClick={() => {
                      setPlaying((current) => !current);
                    }}
                  >
                    {playing ? bodyStrings.pause : bodyStrings.play}
                  </Button>
                )}
              </div>
              {suggestedOnFront && view === 'back' ? (
                <div className="ibm__note" role="note">
                  <p>{bodyStrings.suggestedOnFront}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      changeView('front');
                    }}
                  >
                    {bodyStrings.showFront}
                  </Button>
                </div>
              ) : null}
              <div className="ibm__stage">
                <canvas
                  ref={canvasRef}
                  className="ibm__canvas"
                  role="img"
                  aria-label={bodyStrings.canvas}
                />
                <div
                  ref={labelsRef}
                  className="ibm__labels"
                  aria-hidden="true"
                  data-ready={sceneReady || undefined}
                >
                  <svg className="ibm__leaders" focusable="false">
                    {labels.map((item) => (
                      <line
                        key={item.site}
                        className="ibm__leader"
                        data-leader={item.site}
                        visibility="hidden"
                      />
                    ))}
                  </svg>
                  {labels.map((item) => {
                    const state = stateBySite.get(item.site);
                    return (
                      <span
                        key={item.site}
                        className="ibm__label"
                        data-label={item.site}
                        data-kind={item.kind}
                        hidden
                      >
                        {item.kind === 'point' ? stateIcon(state) : null}
                        {labelText(item, state)}
                      </span>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <p className="ibm__notice">{bodyStrings.unavailable}</p>
          )}
        </div>

        <div className="ibm__options">
          <fieldset className="ibm__sites" aria-describedby={hintId}>
            <legend>{label}</legend>
            {entries.map((entry) => {
              const selectable = isSelectable(entry.state);
              return (
                <label key={entry.site} className="ibm__option" data-state={entry.state}>
                  <input
                    type="radio"
                    name={siteGroupName}
                    value={entry.site}
                    checked={selectedSite === entry.site}
                    disabled={!selectable || readOnly}
                    onChange={() => {
                      chooseSite(entry);
                    }}
                    onFocus={() => {
                      setFocusSite(entry.site);
                    }}
                    onBlur={() => {
                      setFocusSite(null);
                    }}
                  />
                  <span className="ibm__option-name">{bodyStrings.siteShort[entry.site]}</span>
                  {/* The space keeps the accessible name readable: inline spans would otherwise run together. */}{' '}
                  <span className="ibm__option-state">{stateText(entry)}</span>
                </label>
              );
            })}
            <p id={hintId} className="ibm__hint">
              {bodyStrings.siteHint}
            </p>
          </fieldset>

          {readOnly ? (
            <div className="ibm__spots">
              <p className="ibm__legend">{bodyStrings.spotGroup}</p>
              <p className="ibm__readonly-spot">
                {asSpot(selectedSpot) !== null && selectedSite !== null
                  ? format(bodyStrings.spotChosen, { spot: asSpot(selectedSpot) ?? 1 })
                  : bodyStrings.noSpot}
              </p>
            </div>
          ) : (
            <div
              role="group"
              aria-labelledby={`${ids}-spot-legend`}
              aria-describedby={spotHintId}
              className="ibm__spots"
            >
              <p id={`${ids}-spot-legend`} className="ibm__legend">
                {bodyStrings.spotGroup}
              </p>
              <div className="ibm__spot-row">
                {SPOT_NUMBERS.map((spot) => (
                  <Button
                    key={spot}
                    type="button"
                    size="md"
                    variant={selectedSpot === spot ? 'primary' : 'secondary'}
                    className="ibm__spot"
                    aria-pressed={selectedSpot === spot}
                    disabled={selectedSite === null}
                    onClick={() => {
                      if (selectedSite) onSelect(selectedSite, spot);
                    }}
                  >
                    {format(bodyStrings.spotOption, { spot })}
                  </Button>
                ))}
              </div>
              <p id={spotHintId} className="ibm__hint">
                {selectedSite === null
                  ? bodyStrings.spotNeedsSite
                  : selectedEntry?.lastSpot
                    ? format(bodyStrings.spotLastHint, { spot: selectedEntry.lastSpot })
                    : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function stateText(entry: InjectionSiteEntry): string {
  if (entry.state === 'RECENT') {
    return format(bodyStrings.states.RECENT, {
      when: entry.lastUsedLabel ?? bodyStrings.recentUnknown,
    });
  }
  return bodyStrings.states[entry.state];
}

/** Text of a floating label: the suggested or chosen spot, or the site name with its state. */
function labelText(item: MapLabel, state: InjectionState | undefined): string {
  if (item.kind === 'suggested') return format(bodyStrings.labelSuggested, { spot: item.spot });
  if (item.kind === 'selected') return format(bodyStrings.labelSelected, { spot: item.spot });
  const tag = state ? bodyStrings.stateTag[state] : '';
  return format(bodyStrings.labelPoint, { site: bodyStrings.sites[item.site], state: tag });
}

/** Shape next to a state's text: a clock for recently used, an X for avoid. The text still says it. */
function stateIcon(state: InjectionState | undefined) {
  if (state === 'RECENT') return <Clock size="1em" aria-hidden="true" />;
  if (state === 'AVOID') return <X size="1em" aria-hidden="true" />;
  return null;
}
