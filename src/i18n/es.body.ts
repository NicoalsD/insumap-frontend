/**
 * Visible texts of the injection-site body map (`src/ui/body`). Keys are English; values are Spanish
 * (Colombia). `{name}` placeholders are filled by `format()` from `./format`.
 */
export const bodyStrings = {
  views: { front: 'Frente', back: 'Espalda' },
  viewGroup: 'Vista del cuerpo',
  pause: 'Pausar la animación',
  play: 'Reanudar la animación',
  canvas:
    'Cuerpo humano en 3D con los sitios de inyección marcados. La lista junto al modelo tiene la misma información y permite elegir con el teclado.',
  siteHint:
    'Un sitio marcado como Evitar no se puede elegir. Usa las flechas del teclado para moverte por la lista.',
  spotGroup: 'Punto dentro del sitio',
  spotOption: 'Punto {spot}',
  spotNeedsSite: 'Primero elige un sitio.',
  spotLastHint: 'Último punto usado: {spot}.',
  spotChosen: 'Punto elegido: {spot}.',
  noSpot: 'Sin punto elegido.',
  suggestedOnFront: 'Sugerido en la vista de frente',
  showFront: 'Cambiar a Frente',
  /** Short names for the list, so each fits on one line in the side panel. */
  siteShort: {
    ABDOMEN_RIGHT: 'Abdomen der.',
    ABDOMEN_LEFT: 'Abdomen izq.',
    THIGH_RIGHT: 'Muslo der.',
    THIGH_LEFT: 'Muslo izq.',
    ARM_RIGHT: 'Brazo der.',
    ARM_LEFT: 'Brazo izq.',
    BUTTOCK_RIGHT: 'Glúteo der.',
    BUTTOCK_LEFT: 'Glúteo izq.',
  },
  /** Full names, for the labels on the canvas and in the accessible descriptions. */
  sites: {
    ABDOMEN_RIGHT: 'Abdomen, lado derecho',
    ABDOMEN_LEFT: 'Abdomen, lado izquierdo',
    THIGH_RIGHT: 'Muslo derecho',
    THIGH_LEFT: 'Muslo izquierdo',
    ARM_RIGHT: 'Brazo derecho',
    ARM_LEFT: 'Brazo izquierdo',
    BUTTOCK_RIGHT: 'Glúteo derecho',
    BUTTOCK_LEFT: 'Glúteo izquierdo',
  },
  states: {
    SUGGESTED: 'Sugerido: aquí',
    ALLOWED: 'Permitido',
    RECENT: 'Usado {when}',
    AVOID: 'Evitar',
  },
  stateTag: {
    SUGGESTED: 'Aquí',
    ALLOWED: 'Permitido',
    RECENT: 'Reciente',
    AVOID: 'Evitar',
  },
  /** Floating labels on the canvas. */
  labelSuggested: 'Aquí · punto {spot}',
  labelSelected: 'Elegido · punto {spot}',
  labelPoint: '{site} · {state}',
  recentUnknown: 'recientemente',
  unavailable:
    'El modelo 3D no está disponible en este navegador. La lista tiene toda la información.',
};
