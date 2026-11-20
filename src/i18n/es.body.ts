/**
 * Visible texts of the injection-site body map (`src/ui/body`). Keys are English; values are Spanish
 * (Colombia). `{name}` placeholders are filled by `format()` from `./format`.
 */
export const bodyStrings = {
  views: { front: 'Frente', back: 'Espalda' },
  viewGroup: 'Vista del cuerpo',
  /** The round tools over the stage: turn around, zoom, pause. */
  tools: 'Controles del cuerpo',
  flipToBack: 'Ver la espalda',
  flipToFront: 'Ver el frente',
  pause: 'Pausar la animación',
  play: 'Reanudar la animación',
  zoomIn: 'Acercar a los sitios',
  zoomOut: 'Ver el cuerpo completo',
  /** Hint at the corner of the stage: the body itself is the control. */
  hintChoose: 'Toca un punto para elegirlo · arrastra para girar',
  hintRead: 'Arrastra para girar el cuerpo',
  canvas:
    'Cuerpo humano en 3D con los sitios de inyección marcados. Con el teclado, la lista de sitios aparece sobre el cuerpo y tiene la misma información.',
  siteHint:
    'Un sitio marcado como Evitar no se puede elegir. Usa las flechas del teclado para moverte por la lista.',
  spotGroup: 'Punto dentro del sitio',
  spotOption: 'Punto {spot}',
  spotSuggested: 'Punto {spot}, el que sigue en la rotación',
  spotNeedsSite: 'Primero elige un sitio.',
  spotLastHint: 'Último punto usado: {spot}.',
  spotChosen: 'Punto elegido: {spot}.',
  noSpot: 'Sin punto elegido.',
  /** Floating note when the suggested site is on the side the body is not showing. */
  suggestedOnFront: 'El sitio sugerido está al frente',
  suggestedOnBack: 'El sitio sugerido está en la espalda',
  turnToIt: 'Girar',
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
