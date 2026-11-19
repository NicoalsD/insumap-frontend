import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bodyStrings } from '@/i18n/es.body';
import { expectNoAxeViolations } from '@/test/axe';
import type { InjectionSiteEntry } from './injectionModel';
import { InjectionBodyMap } from './InjectionBodyMap';
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
vi.mock('@/app/pages/landing/art/bodyMesh', () => ({ loadBodyMesh: () => Promise.resolve({}) }));
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
  it('shows only the native list, with the notice and no canvas', () => {
    const errors = vi.spyOn(console, 'error');
    const { container } = renderMap();
    expect(container.querySelector('canvas')).toBeNull();
    expect(screen.getByText(bodyStrings.unavailable)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: bodyStrings.views.front })).toBeNull();
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
    expect(screen.getByRole('button', { name: 'Punto 2' })).toHaveAttribute('aria-pressed', 'true');
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
    expect(screen.getByRole('button', { name: 'Punto 4' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('chooses a site with the default spot after the last one used', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderMap();
    await user.click(screen.getByRole('radio', { name: /Muslo der\./ }));
    expect(onSelect).toHaveBeenCalledWith('THIGH_RIGHT', 3);
  });

  it('chooses a spot of the selected site', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderMap({ selectedSite: 'ABDOMEN_RIGHT', selectedSpot: 1 });
    await user.click(screen.getByRole('button', { name: 'Punto 4' }));
    expect(onSelect).toHaveBeenCalledWith('ABDOMEN_RIGHT', 4);
  });

  it('keeps the spot choice disabled until a site is selected', () => {
    renderMap();
    expect(screen.getByRole('button', { name: 'Punto 1' })).toBeDisabled();
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

describe('WebGL path with a fake scene', () => {
  it('renders the canvas, the view buttons and the labels, and passes axe', async () => {
    fake.supported = true;
    const { container } = renderMap();
    await waitFor(() => {
      expect(fake.scenes).toHaveLength(1);
    });
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas).toHaveAttribute('role', 'img');
    expect(screen.getByRole('button', { name: bodyStrings.views.front })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(container.querySelector('.ibm__labels')).toHaveAttribute('aria-hidden', 'true');
    await expectNoAxeViolations(container);
  });

  it('switches the view and tells the parent, and the scene follows', async () => {
    fake.supported = true;
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    renderMap({ onViewChange });
    await waitFor(() => {
      expect(fake.scenes).toHaveLength(1);
    });
    await user.click(screen.getByRole('button', { name: bodyStrings.views.back }));
    expect(onViewChange).toHaveBeenCalledWith('back');
    expect(screen.getByRole('button', { name: bodyStrings.views.back })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const scene = fake.scenes[0];
    expect(scene?.apply).toHaveBeenLastCalledWith(expect.objectContaining({ view: 'back' }));
  });

  it('turns to the back when a back site is chosen in the list', async () => {
    fake.supported = true;
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    const { onSelect } = renderMap({ onViewChange });
    await waitFor(() => {
      expect(fake.scenes).toHaveLength(1);
    });
    await user.click(screen.getByRole('radio', { name: /Brazo der\./ }));
    expect(onViewChange).toHaveBeenCalledWith('back');
    expect(onSelect).toHaveBeenCalledWith('ARM_RIGHT', 1);
  });

  it('forwards a tap on a marker as a selection', async () => {
    fake.supported = true;
    const { onSelect } = renderMap();
    await waitFor(() => {
      expect(fake.scenes).toHaveLength(1);
    });
    fake.scenes[0]?.options.onPick('ABDOMEN_RIGHT', 4);
    expect(onSelect).toHaveBeenCalledWith('ABDOMEN_RIGHT', 4);
  });

  it('pauses the continuous motion from the visible button', async () => {
    fake.supported = true;
    const user = userEvent.setup();
    renderMap();
    await waitFor(() => {
      expect(fake.scenes).toHaveLength(1);
    });
    await user.click(screen.getByRole('button', { name: bodyStrings.pause }));
    const scene = fake.scenes[0];
    expect(scene?.apply).toHaveBeenLastCalledWith(expect.objectContaining({ playing: false }));
    expect(screen.getByRole('button', { name: bodyStrings.play })).toBeInTheDocument();
  });

  it('has no pause button and a still scene with reduced motion', async () => {
    fake.supported = true;
    window.matchMedia = (query: string) =>
      ({ matches: query.includes('reduce'), media: query }) as MediaQueryList;
    renderMap();
    await waitFor(() => {
      expect(fake.scenes).toHaveLength(1);
    });
    expect(screen.queryByRole('button', { name: bodyStrings.pause })).toBeNull();
    const scene = fake.scenes[0];
    expect(scene?.apply).toHaveBeenLastCalledWith(expect.objectContaining({ playing: false }));
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
    fake.supported = true;
    const { unmount } = renderMap();
    await waitFor(() => {
      expect(fake.scenes).toHaveLength(1);
    });
    const scene = fake.scenes[0];
    unmount();
    expect(scene?.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('read-only map', () => {
  it('shows the chosen spot as text and offers no spot buttons', () => {
    renderMap({ selectedSite: 'ABDOMEN_LEFT', selectedSpot: 2, readOnly: true });
    expect(screen.getByText('Punto elegido: 2.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Punto 1' })).toBeNull();
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
    fake.supported = true;
    const { onSelect } = renderMap({ readOnly: true });
    await waitFor(() => {
      expect(fake.scenes).toHaveLength(1);
    });
    expect(fake.scenes[0]?.apply).toHaveBeenLastCalledWith(
      expect.objectContaining({ readOnly: true }),
    );
    fake.scenes[0]?.options.onPick('ABDOMEN_RIGHT', 4);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('still switches between front and back', async () => {
    fake.supported = true;
    const user = userEvent.setup();
    renderMap({ readOnly: true });
    await waitFor(() => {
      expect(fake.scenes).toHaveLength(1);
    });
    await user.click(screen.getByRole('button', { name: bodyStrings.views.back }));
    expect(screen.getByRole('button', { name: bodyStrings.views.back })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('suggested site on the other side', () => {
  it('offers a button to the front when the back is showing', async () => {
    fake.supported = true;
    const user = userEvent.setup();
    renderMap({ defaultView: 'back' });
    await waitFor(() => {
      expect(fake.scenes).toHaveLength(1);
    });
    expect(screen.getByRole('note')).toHaveTextContent(bodyStrings.suggestedOnFront);
    await user.click(screen.getByRole('button', { name: bodyStrings.showFront }));
    expect(screen.getByRole('button', { name: bodyStrings.views.front })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('shows no note on the front', async () => {
    fake.supported = true;
    renderMap();
    await waitFor(() => {
      expect(fake.scenes).toHaveLength(1);
    });
    expect(screen.queryByRole('note')).toBeNull();
  });
});
