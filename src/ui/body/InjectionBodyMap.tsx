import { Clock, Hand, Pause, Play, RefreshCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { bodyStrings } from '@/i18n/es.body';
import { format } from '@/i18n/format';
import type { PatientSex } from '@/services/dto/injection';
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
   * Show the map without choosing: states and labels stay, the body still turns, but the radios and
   * spot choice are off, `onSelect` is never called, and the pointer keeps its normal shape.
   */
  readonly readOnly?: boolean | undefined;
  /** The patient's recorded sex and BMI: the body takes their build. Unknown keeps it neutral. */
  readonly sex?: PatientSex | undefined;
  readonly bmi?: number | null | undefined;
  /** Fill the parent's height (a page column that sizes the stage) instead of a 3:4 box. */
  readonly fill?: boolean | undefined;
}

const HALF_TURN_DEG = 180;
const FULL_TURN_DEG = 360;
const QUARTER_TURN_DEG = 90;
const PERCENT = 100;
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

/**
 * Where to inject: a translucent 3D body that is itself the control. Drag turns it, a double click
 * or a pinch brings the sites closer, and a tap on a marker chooses that site and spot. Everything
 * else floats over the stage (the note about the other side, two round tools, the hint), so nothing
 * that appears or disappears moves the body.
 *
 * The keyboard and screen-reader path is the native radio list with the same sites and states. It
 * stays visually hidden until it takes focus, then opens as a floating panel over the stage while
 * the body labels the focused site. Without WebGL the list is shown in the page instead.
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
  fill = false,
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
  /** The side that shows the suggested site, when the body is turned to the other one. */
  const suggestedSide =
    suggestedEntry !== undefined && siteView(suggestedEntry.site) !== view
      ? siteView(suggestedEntry.site)
      : null;

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

  const zoomed = zoomPct > ZOOM_MIN * PERCENT;
  /** The zoom tool (or a double click) brings the sites close; the next one frames the body again. */
  const toggleZoom = () => {
    setZoomPct((current) => (current > ZOOM_MIN * PERCENT ? ZOOM_MIN * PERCENT : ZOOM_MAX * PERCENT));
  };

  const keys = (
    <SiteKeys
      ids={ids}
      label={label}
      entries={entries}
      selectedSite={selectedSite}
      selectedSpot={selectedSpot}
      selectedEntry={selectedEntry}
      readOnly={readOnly}
      onChoose={chooseSite}
      onSpot={(spot) => {
        if (selectedSite) onSelect(selectedSite, spot);
      }}
      onFocusSite={setFocusSite}
    />
  );

  if (!showStage) {
    return (
      <div className={readOnly ? 'ibm ibm--static ibm--readonly' : 'ibm ibm--static'}>
        <p className="ibm__notice">{bodyStrings.unavailable}</p>
        <div className="ibm__keys ibm__keys--static">{keys}</div>
      </div>
    );
  }

  const classes = ['ibm', readOnly ? 'ibm--readonly' : '', fill ? 'ibm--fill' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <div className="ibm__stage">
        <canvas
          ref={canvasRef}
          className="ibm__canvas"
          role="img"
          aria-label={bodyStrings.canvas}
          onDoubleClick={toggleZoom}
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

        {/* Over the stage, never in the flow: it can appear without moving the body. */}
        {suggestedSide ? (
          <button
            type="button"
            className="ibm__chip"
            onClick={() => {
              changeView(suggestedSide);
            }}
          >
            <span>
              {suggestedSide === 'front' ? bodyStrings.suggestedOnFront : bodyStrings.suggestedOnBack}
            </span>
            <span className="ibm__chip-action">{bodyStrings.turnToIt}</span>
          </button>
        ) : null}

        <div className="ibm__keys visually-hidden">{keys}</div>

        <div className="ibm__tools" role="group" aria-label={bodyStrings.tools}>
          <button
            type="button"
            className="ibm__tool"
            aria-label={view === 'front' ? bodyStrings.flipToBack : bodyStrings.flipToFront}
            title={view === 'front' ? bodyStrings.flipToBack : bodyStrings.flipToFront}
            onClick={() => {
              changeView(view === 'front' ? 'back' : 'front');
            }}
          >
            <RefreshCcw aria-hidden="true" />
          </button>
          <button
            type="button"
            className="ibm__tool"
            aria-label={zoomed ? bodyStrings.zoomOut : bodyStrings.zoomIn}
            title={zoomed ? bodyStrings.zoomOut : bodyStrings.zoomIn}
            onClick={toggleZoom}
          >
            {zoomed ? <ZoomOut aria-hidden="true" /> : <ZoomIn aria-hidden="true" />}
          </button>
          {reduced ? null : (
            <button
              type="button"
              className="ibm__tool"
              aria-label={playing ? bodyStrings.pause : bodyStrings.play}
              title={playing ? bodyStrings.pause : bodyStrings.play}
              onClick={() => {
                setPlaying((current) => !current);
              }}
            >
              {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </button>
          )}
        </div>

        <p className="ibm__hint-chip">
          <Hand aria-hidden="true" />
          <span>{readOnly ? bodyStrings.hintRead : bodyStrings.hintChoose}</span>
        </p>
      </div>
    </div>
  );
}

interface SiteKeysProps {
  readonly ids: string;
  readonly label: string;
  readonly entries: readonly InjectionSiteEntry[];
  readonly selectedSite: SiteCode | null;
  readonly selectedSpot: number | null;
  readonly selectedEntry: InjectionSiteEntry | undefined;
  readonly readOnly: boolean;
  readonly onChoose: (entry: InjectionSiteEntry) => void;
  readonly onSpot: (spot: SpotNumber) => void;
  readonly onFocusSite: (site: SiteCode | null) => void;
}

/** The native path: one radio per site with its state in words, then the spot within the site. */
function SiteKeys({
  ids,
  label,
  entries,
  selectedSite,
  selectedSpot,
  selectedEntry,
  readOnly,
  onChoose,
  onSpot,
  onFocusSite,
}: SiteKeysProps) {
  const hintId = `${ids}-hint`;
  const spotHintId = `${ids}-spot-hint`;
  const suggestedSpot = selectedEntry ? defaultSpotFor(selectedEntry) : null;
  return (
    <>
      <fieldset className="ibm__sites" aria-describedby={hintId}>
        <legend>{label}</legend>
        {entries.map((entry) => {
          const selectable = isSelectable(entry.state);
          return (
            <label key={entry.site} className="ibm__option" data-state={entry.state}>
              <input
                type="radio"
                name={`${ids}-site`}
                value={entry.site}
                checked={selectedSite === entry.site}
                disabled={!selectable || readOnly}
                onChange={() => {
                  onChoose(entry);
                }}
                onFocus={() => {
                  onFocusSite(entry.site);
                }}
                onBlur={() => {
                  onFocusSite(null);
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
        <p className="ibm__readonly-spot">
          {asSpot(selectedSpot) !== null && selectedSite !== null
            ? format(bodyStrings.spotChosen, { spot: asSpot(selectedSpot) ?? 1 })
            : bodyStrings.noSpot}
        </p>
      ) : (
        <fieldset
          className="ibm__spots"
          disabled={selectedSite === null}
          aria-describedby={spotHintId}
        >
          <legend>{bodyStrings.spotGroup}</legend>
          <div className="ibm__spot-row">
            {SPOT_NUMBERS.map((spot) => (
              <label key={spot} className="ibm__spot">
                <input
                  type="radio"
                  name={`${ids}-spot`}
                  value={spot}
                  checked={selectedSite !== null && asSpot(selectedSpot) === spot}
                  onChange={() => {
                    onSpot(spot);
                  }}
                />
                {suggestedSpot === spot
                  ? format(bodyStrings.spotSuggested, { spot })
                  : format(bodyStrings.spotOption, { spot })}
              </label>
            ))}
          </div>
          <p id={spotHintId} className="ibm__hint">
            {selectedSite === null
              ? bodyStrings.spotNeedsSite
              : selectedEntry?.lastSpot
                ? format(bodyStrings.spotLastHint, { spot: selectedEntry.lastSpot })
                : ''}
          </p>
        </fieldset>
      )}
    </>
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
