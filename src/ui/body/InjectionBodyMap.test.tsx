import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bodyStrings } from '@/i18n/es.body';
import { expectNoAxeViolations } from '@/test/axe';
import type { InjectionSiteEntry } from './injectionModel';
import { InjectionBodyMap } from './InjectionBodyMap';
import { ZOOM_MAX, ZOOM_MIN } from './injectionZoom';
import type { SiteCode, SpotNumber } from './siteCodes';

/**
 * Fakes for the WebGL path. jsdom has no WebGL, so the component is tested with `canRender3D`
 * switched and the scene module replaced: the fake scene records every plan it receives and hands
 * back its `onPick` so a test can play the tap on a marker.
 */
const fake = vi.hoisted(() => ({
  supported: false,
  returnNull: false,
  scenes: [] as {
    options: { onPick: (site: string, spot: number) => void };
    apply: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }[],
}));

vi.mock('./webglSupport', () => ({ canRender3D: () => fake.supported }));
vi.mock('./bodyAsset', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./bodyAsset')>();
  return { ...actual, loadBodyAsset: () => Promise.resolve({}) };
});

const SPOT = { name: bodyStrings.spotGroup };
const TOOLS = { name: bodyStrings.tools };
vi.mock('./injectionScene', () => ({
  createInjectionScene: (options: { onPick: (site: string, spot: number) => void }) => {
    if (fake.returnNull) return null;
    const scene = { options, apply: vi.fn(), dispose: vi.fn() };
    fake.scenes.push(scene);
    return scene;
  },
}));

const sites: InjectionSiteEntry[] = [
  { site: 'ABDOMEN_RIGHT', state: 'SUGGESTED', lastSpot: 4 },
  { site: 'ABDOMEN_LEFT', state: 'ALLOWED', lastSpot: 1 },
  { site: 'THIGH_RIGHT', state: 'ALLOWED', lastSpot: 2 },
  { site: 'THIGH_LEFT', state: 'RECENT', lastUsedLabel: 'hace 2 h', lastSpot: 3 },
  { site: 'ARM_RIGHT', state: 'ALLOWED', lastSpot: null },
  { site: 'ARM_LEFT', state: 'AVOID' },
  { site: 'BUTTOCK_RIGHT', state: 'ALLOWED' },
  { site: 'BUTTOCK_LEFT', state: 'ALLOWED' },
];

const LABEL = 'Sitio de inyección';

interface HarnessProps {
  selectedSite?: SiteCode | null;
  selectedSpot?: number | null;
  onSelect?: (site: SiteCode, spot: SpotNumber) => void;
  onViewChange?: (view: 'front' | 'back') => void;
  readOnly?: boolean;
  defaultView?: 'front' | 'back';
}

function renderMap(props: HarnessProps = {}) {
  const onSelect = props.onSelect ?? vi.fn();
  const result = render(
    <InjectionBodyMap
      sites={sites}
      selectedSite={props.selectedSite ?? null}
      selectedSpot={props.selectedSpot ?? null}
      onSelect={onSelect}
      onViewChange={props.onViewChange}
      readOnly={props.readOnly}
      defaultView={props.defaultView}
      label={LABEL}
    />,
  );
  return { ...result, onSelect };
}

beforeEach(() => {
  fake.supported = false;
  fake.returnNull = false;
  fake.scenes.length = 0;
});

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('InjectionBodyMap without WebGL', () => {
  it('shows only the native list, with the notice and no canvas or tools', () => {
    const errors = vi.spyOn(console, 'error');
    const { container } = renderMap();
    expect(container.querySelector('canvas')).toBeNull();
    expect(screen.getByText(bodyStrings.unavailable)).toBeInTheDocument();
    expect(screen.queryByRole('group', TOOLS)).toBeNull();
    expect(errors).not.toHaveBeenCalled();
  });

  it('passes axe with the list alone', async () => {
    const { container } = renderMap({ selectedSite: 'ABDOMEN_RIGHT', selectedSpot: 1 });
    await expectNoAxeViolations(container);
  });

  it('exposes the sites as a native radio group with the same states as the 3D map', () => {
    renderMap();
    const group = screen.getByRole('group', { name: LABEL });
    expect(within(group).getAllByRole('radio')).toHaveLength(sites.length);
  });
});

describe('list and selection', () => {
  it('reflects the selected site and spot in the native radios', () => {
    const { rerender } = renderMap({ selectedSite: 'ABDOMEN_LEFT', selectedSpot: 2 });
    expect(screen.getByRole('radio', { name: /Abdomen izq\./ })).toBeChecked();
    expect(within(screen.getByRole('group', SPOT)).getByRole('radio', { name: /^Punto 2/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Abdomen der\./ })).not.toBeChecked();

    rerender(
      <InjectionBodyMap
        sites={sites}
        selectedSite="THIGH_RIGHT"
        selectedSpot={4}
        onSelect={vi.fn()}
        label={LABEL}
      />,
    );
    expect(screen.getByRole('radio', { name: /Muslo der\./ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Abdomen izq\./ })).not.toBeChecked();
    expect(within(screen.getByRole('group', SPOT)).getByRole('radio', { name: /^Punto 4/ })).toBeChecked();
  });

  it('chooses a site with the default spot after the last one used', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderMap();
    await user.click(screen.getByRole('radio', { name: /Muslo der\./ }));
    expect(onSelect).toHaveBeenCalledWith('THIGH_RIGHT', 3);
  });

  it('chooses a spot of the selected site and names the next one in the rotation', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderMap({ selectedSite: 'ABDOMEN_RIGHT', selectedSpot: 1 });
    const spots = screen.getByRole('group', SPOT);
    expect(within(spots).getByRole('radio', { name: bodyStrings.spotSuggested.replace('{spot}', '1') })).toBeChecked();
    await user.click(within(spots).getByRole('radio', { name: /^Punto 4/ }));
    expect(onSelect).toHaveBeenCalledWith('ABDOMEN_RIGHT', 4);
  });

  it('keeps the spot choice disabled until a site is selected', () => {
    renderMap();
    const spots = within(screen.getByRole('group', SPOT)).getAllByRole('radio');
    expect(spots).toHaveLength(4);
    for (const spot of spots) expect(spot).toBeDisabled();
    expect(screen.getByText(bodyStrings.spotNeedsSite)).toBeInTheDocument();
  });

  it('does not let the user choose an AVOID site', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderMap();
    const avoid = screen.getByRole('radio', { name: /Brazo izq\./ });
    expect(avoid).toBeDisabled();
    await user.click(avoid);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('moves between sites with the arrow keys', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderMap({ selectedSite: 'ABDOMEN_RIGHT', selectedSpot: 1 });
    screen.getByRole('radio', { name: /Abdomen der\./ }).focus();
    await user.keyboard('{ArrowDown}');
    expect(onSelect).toHaveBeenCalledWith('ABDOMEN_LEFT', 2);
  });
});

describe('states with text', () => {
  it('names each state in words, not only by color', () => {
    renderMap();
    expect(screen.getByRole('radio', { name: /Abdomen der\. Sugerido: aquí/ })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /Abdomen izq\. Permitido/ })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /Muslo izq\. Usado hace 2 h/ })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /Brazo izq\. Evitar/ })).toBeDisabled();
  });

  it('says which spot was used last for the selected site', () => {
    renderMap({ selectedSite: 'THIGH_LEFT', selectedSpot: 1 });
    expect(screen.getByText('Último punto usado: 3.')).toBeInTheDocument();
  });
});

/** Renders the WebGL path and waits for the fake scene. */
async function renderStage(props: HarnessProps = {}) {
  fake.supported = true;
  const result = renderMap(props);
  await waitFor(() => {
    expect(fake.scenes).toHaveLength(1);
  });
  return result;
}

describe('WebGL path with a fake scene: the body is the control', () => {
  it('renders the canvas, the round tools and the labels, with no sliders, and passes axe', async () => {
    const { container } = await renderStage();
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas).toHaveAttribute('role', 'img');
    expect(screen.queryAllByRole('slider')).toHaveLength(0);
    const tools = screen.getByRole('group', TOOLS);
    expect(within(tools).getByRole('button', { name: bodyStrings.flipToBack })).toBeInTheDocument();
    expect(within(tools).getByRole('button', { name: bodyStrings.zoomIn })).toBeInTheDocument();
    expect(container.querySelector('.ibm__labels')).toHaveAttribute('aria-hidden', 'true');
    await expectNoAxeViolations(container);
  });

  it('keeps the keyboard list inside the stage, visually hidden until it takes focus', async () => {
    const { container } = await renderStage();
    const keys = container.querySelector('.ibm__stage .ibm__keys');
    expect(keys).toHaveClass('visually-hidden');
    expect(within(keys as HTMLElement).getByRole('group', { name: LABEL })).toBeInTheDocument();
  });

  it('turns to the back with the tool, tells the parent, and the scene follows', async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    await renderStage({ onViewChange });
    await user.click(screen.getByRole('button', { name: bodyStrings.flipToBack }));
    expect(onViewChange).toHaveBeenCalledWith('back');
    expect(fake.scenes[0]?.apply).toHaveBeenLastCalledWith(
      expect.objectContaining({ view: 'back', azimuth: Math.PI }),
    );
    await user.click(screen.getByRole('button', { name: bodyStrings.flipToFront }));
    expect(onViewChange).toHaveBeenLastCalledWith('front');
  });

  it('brings the sites close with the zoom tool or a double click on the body', async () => {
    const user = userEvent.setup();
    const { container } = await renderStage();
    await user.click(screen.getByRole('button', { name: bodyStrings.zoomIn }));
    expect(fake.scenes[0]?.apply).toHaveBeenLastCalledWith(expect.objectContaining({ zoom: ZOOM_MAX }));
    expect(screen.getByRole('button', { name: bodyStrings.zoomOut })).toBeInTheDocument();
    await user.dblClick(container.querySelector('canvas') as HTMLCanvasElement);
    expect(fake.scenes[0]?.apply).toHaveBeenLastCalledWith(expect.objectContaining({ zoom: ZOOM_MIN }));
  });

  it('turns to the back when a back site is chosen in the list', async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    const { onSelect } = await renderStage({ onViewChange });
    await user.click(screen.getByRole('radio', { name: /Brazo der\./ }));
    expect(onViewChange).toHaveBeenCalledWith('back');
    expect(onSelect).toHaveBeenCalledWith('ARM_RIGHT', 1);
  });

  it('forwards a tap on a marker as a selection', async () => {
    const { onSelect } = await renderStage();
    fake.scenes[0]?.options.onPick('ABDOMEN_RIGHT', 4);
    expect(onSelect).toHaveBeenCalledWith('ABDOMEN_RIGHT', 4);
  });

  it('pauses the continuous motion from its round tool', async () => {
    const user = userEvent.setup();
    await renderStage();
    await user.click(screen.getByRole('button', { name: bodyStrings.pause }));
    expect(fake.scenes[0]?.apply).toHaveBeenLastCalledWith(expect.objectContaining({ playing: false }));
    expect(screen.getByRole('button', { name: bodyStrings.play })).toBeInTheDocument();
  });

  it('has no pause tool and a still scene with reduced motion', async () => {
    window.matchMedia = (query: string) =>
      ({ matches: query.includes('reduce'), media: query }) as MediaQueryList;
    await renderStage();
    expect(screen.queryByRole('button', { name: bodyStrings.pause })).toBeNull();
    expect(fake.scenes[0]?.apply).toHaveBeenLastCalledWith(expect.objectContaining({ playing: false }));
  });

  it('falls back to the list when the scene cannot start', async () => {
    fake.supported = true;
    fake.returnNull = true;
    const { container } = renderMap();
    await waitFor(() => {
      expect(screen.getByText(bodyStrings.unavailable)).toBeInTheDocument();
    });
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('disposes the scene on unmount', async () => {
    const { unmount } = await renderStage();
    const scene = fake.scenes[0];
    unmount();
    expect(scene?.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('read-only map', () => {
  it('shows the chosen spot as text and offers no spot choice', () => {
    renderMap({ selectedSite: 'ABDOMEN_LEFT', selectedSpot: 2, readOnly: true });
    expect(screen.getByText('Punto elegido: 2.')).toBeInTheDocument();
    expect(screen.queryByRole('group', SPOT)).toBeNull();
  });

  it('keeps the states visible but disables every site choice', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderMap({
      selectedSite: 'ABDOMEN_LEFT',
      selectedSpot: 2,
      readOnly: true,
    });
    const radios = screen.getAllByRole('radio');
    expect(radios.every((radio) => (radio as HTMLInputElement).disabled)).toBe(true);
    expect(screen.getByRole('radio', { name: /Abdomen izq\. Permitido/ })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: /Muslo der\./ }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('never selects from a marker tap', async () => {
    const { onSelect } = await renderStage({ readOnly: true });
    expect(fake.scenes[0]?.apply).toHaveBeenLastCalledWith(
      expect.objectContaining({ readOnly: true }),
    );
    fake.scenes[0]?.options.onPick('ABDOMEN_RIGHT', 4);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('still turns between front and back', async () => {
    const user = userEvent.setup();
    await renderStage({ readOnly: true });
    await user.click(screen.getByRole('button', { name: bodyStrings.flipToBack }));
    expect(fake.scenes[0]?.apply).toHaveBeenLastCalledWith(expect.objectContaining({ view: 'back' }));
    expect(screen.getByText(bodyStrings.hintRead)).toBeInTheDocument();
  });
});

describe('suggested site on the other side', () => {
  it('floats a note over the stage that turns the body to the front', async () => {
    const user = userEvent.setup();
    const { container } = await renderStage({ defaultView: 'back' });
    const note = screen.getByRole('button', { name: new RegExp(bodyStrings.suggestedOnFront) });
    // Inside the stage and out of the flow: it can come and go without moving the body.
    expect(note.closest('.ibm__stage')).toBe(container.querySelector('.ibm__stage'));
    await user.click(note);
    expect(fake.scenes[0]?.apply).toHaveBeenLastCalledWith(
      expect.objectContaining({ view: 'front', azimuth: 0 }),
    );
    expect(screen.queryByRole('button', { name: new RegExp(bodyStrings.suggestedOnFront) })).toBeNull();
  });

  it('shows no note while the suggested side is showing', async () => {
    await renderStage();
    expect(screen.queryByRole('button', { name: new RegExp(bodyStrings.suggestedOnFront) })).toBeNull();
    expect(screen.queryByRole('button', { name: new RegExp(bodyStrings.suggestedOnBack) })).toBeNull();
  });
});
