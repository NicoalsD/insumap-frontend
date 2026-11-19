import { Clock, Pause, Play, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { bodyStrings } from '@/i18n/es.body';
import { format } from '@/i18n/format';
import type { PatientSex } from '@/services/dto/injection';
import { Button } from '@/ui/Button';
import { ChoiceSlider, Slider } from '@/ui/Slider';
import { loadBodyAsset, shapeFor } from './bodyAsset';
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
import { ZOOM_MAX, ZOOM_MIN } from './injectionZoom';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { canRender3D } from './webglSupport';
import {
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
  /** The patient's recorded sex and BMI: the body takes their build. Unknown keeps it neutral. */
  readonly sex?: PatientSex | undefined;
  readonly bmi?: number | null | undefined;
}

const HALF_TURN_DEG = 180;
const FULL_TURN_DEG = 360;
const QUARTER_TURN_DEG = 90;
const TURN_STEP_DEG = 5;
const NAMED_TURN_TOLERANCE_DEG = 10;
const PERCENT = 100;
const ZOOM_STEP_PCT = 10;
const DEG_TO_RAD = Math.PI / HALF_TURN_DEG;

/** The angle that shows a view: the front faces the camera at 0, the back at 180. */
const VIEW_ANGLE: Record<BodyView, number> = { front: 0, back: HALF_TURN_DEG };

/** An angle in (-180, 180]. */
function normalizeAngle(degrees: number): number {
  const turned =
    ((((degrees + HALF_TURN_DEG) % FULL_TURN_DEG) + FULL_TURN_DEG) % FULL_TURN_DEG) - HALF_TURN_DEG;
  return turned === -HALF_TURN_DEG ? HALF_TURN_DEG : turned;
}

/** Front while the face is toward the camera (within a quarter turn), back otherwise. */
function viewOf(angle: number): BodyView {
  return Math.abs(normalizeAngle(angle)) <= QUARTER_TURN_DEG ? 'front' : 'back';
}

/** What the turn shows, in words: a named side near the marks, else the degrees and the side. */
function turnText(angle: number): string {
  const named: readonly [number, string][] = [
    [0, bodyStrings.turnNamed.front],
    [HALF_TURN_DEG, bodyStrings.turnNamed.back],
    [-HALF_TURN_DEG, bodyStrings.turnNamed.back],
    [QUARTER_TURN_DEG, bodyStrings.turnNamed.left],
    [-QUARTER_TURN_DEG, bodyStrings.turnNamed.right],
  ];
  const near = named.find(([at]) => Math.abs(angle - at) <= NAMED_TURN_TOLERANCE_DEG);
  if (near) return near[1];
  return format(bodyStrings.turnDegrees, {
    degrees: Math.abs(Math.round(angle)),
    side: angle > 0 ? bodyStrings.turnSide.left : bodyStrings.turnSide.right,
  });
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
  sex = 'UNKNOWN',
  bmi = null,
}: InjectionBodyMapProps) {
  const ids = useId();
  const [angle, setAngle] = useState<number>(() => VIEW_ANGLE[viewProp ?? defaultView]);
  const [zoomPct, setZoomPct] = useState(ZOOM_MIN * PERCENT);
  const view = viewOf(angle);
  const shape = useMemo(() => shapeFor(sex, bmi), [sex, bmi]);
  // A parent that controls the view turns the body to it when the angle shows the other side.
  const [lastViewProp, setLastViewProp] = useState(viewProp);
  if (viewProp !== lastViewProp) {
    setLastViewProp(viewProp);
    if (viewProp !== undefined && viewProp !== viewOf(angle)) setAngle(VIEW_ANGLE[viewProp]);
  }
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

  const onViewChangeRef = useRef(onViewChange);
  const turnTo = (next: number) => {
    const normalized = normalizeAngle(next);
    setAngle(normalized);
    if (viewOf(normalized) !== viewOf(angle)) onViewChangeRef.current?.(viewOf(normalized));
  };
  const changeView = (next: BodyView) => {
    if (next === view) return;
    turnTo(VIEW_ANGLE[next]);
  };

  const chooseSite = (entry: InjectionSiteEntry) => {
    if (readOnly) return;
    changeView(siteView(entry.site));
    onSelect(entry.site, defaultSpotFor(entry));
  };

  const motion = playing && !reduced;
  const plan = useMemo<InjectionScenePlan>(
    () => ({
      view,
      azimuth: angle * DEG_TO_RAD,
      zoom: zoomPct / PERCENT,
      shape,
      sites: entries,
      selectedSite,
      selectedSpot,
      playing: motion,
      labels,
      readOnly,
    }),
    [view, angle, zoomPct, shape, entries, selectedSite, selectedSpot, motion, labels, readOnly],
  );

  // The latest angle, read by the drag callback the scene holds.
  const angleRef = useRef(angle);
  useEffect(() => {
    onSelectRef.current = onSelect;
    readOnlyRef.current = readOnly;
    onViewChangeRef.current = onViewChange;
    angleRef.current = angle;
  }, [onSelect, readOnly, onViewChange, angle]);

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
    void Promise.all([import('./injectionScene'), loadBodyAsset()])
      .then(([{ createInjectionScene }, body]) => {
        if (cancelled) return;
        const scene = createInjectionScene({
          canvas,
          labelHost,
          reducedMotion: reduced,
          body,
          onRotate: (azimuth) => {
            const next = normalizeAngle(azimuth / DEG_TO_RAD);
            if (viewOf(next) !== viewOf(angleRef.current)) onViewChangeRef.current?.(viewOf(next));
            angleRef.current = next;
            setAngle(next);
          },
          onZoom: (zoom) => {
            setZoomPct(Math.round(zoom * PERCENT));
          },
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
              <div className="ibm__controls">
                <Slider
                  className="ibm__turn"
                  label={bodyStrings.turn}
                  value={Math.round(angle)}
                  min={-HALF_TURN_DEG}
                  max={HALF_TURN_DEG}
                  step={TURN_STEP_DEG}
                  origin={0}
                  valueText={turnText}
                  describedBy={`${ids}-drag-hint`}
                  marks={[
                    { value: -HALF_TURN_DEG, label: bodyStrings.turnMarks.back },
                    { value: -QUARTER_TURN_DEG, label: bodyStrings.turnMarks.right },
                    { value: 0, label: bodyStrings.turnMarks.front },
                    { value: QUARTER_TURN_DEG, label: bodyStrings.turnMarks.left },
                    { value: HALF_TURN_DEG, label: bodyStrings.turnMarks.back },
                  ]}
                  onChange={turnTo}
                />
                <Slider
                  className="ibm__zoom"
                  label={bodyStrings.zoom}
                  value={zoomPct}
                  min={ZOOM_MIN * PERCENT}
                  max={ZOOM_MAX * PERCENT}
                  step={ZOOM_STEP_PCT}
                  valueText={(value) => format(bodyStrings.zoomValue, { value })}
                  marks={[
                    { value: ZOOM_MIN * PERCENT, label: bodyStrings.zoomMarks.far },
                    { value: ZOOM_MAX * PERCENT, label: bodyStrings.zoomMarks.near },
                  ]}
                  onChange={setZoomPct}
                />
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
              <p id={`${ids}-drag-hint`} className="ibm__hint ibm__drag-hint">
                {bodyStrings.dragHint}
              </p>
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
              <ChoiceSlider
                className="ibm__spot-slider"
                label={bodyStrings.spotGroup}
                hideLabel
                size="lg"
                value={asSpot(selectedSpot) ?? 1}
                highlight={selectedEntry ? defaultSpotFor(selectedEntry) : undefined}
                disabled={selectedSite === null}
                describedBy={spotHintId}
                options={SPOT_NUMBERS.map((spot) => ({
                  value: spot,
                  label: format(bodyStrings.spotOption, { spot }),
                  text:
                    selectedEntry && defaultSpotFor(selectedEntry) === spot
                      ? format(bodyStrings.spotSuggested, { spot })
                      : format(bodyStrings.spotOption, { spot }),
                }))}
                onChange={(spot) => {
                  if (selectedSite) onSelect(selectedSite, spot);
                }}
              />
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
