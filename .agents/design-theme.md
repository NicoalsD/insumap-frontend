# Tema visual y tokens

Fuente única: [`src/styles/tokens.css`](../src/styles/tokens.css). Los componentes usan solo `var(--token)`; ningún color, tamaño, espacio, sombra ni duración se escribe a mano en un componente. La dirección visual que estos tokens implementan está en [`.impeccable/direction.md`](../.impeccable/direction.md).

## 1. Temas

| Tema | Cuándo | Cómo |
|---|---|---|
| Claro | Siempre por defecto | Bloque `:root` de `tokens.css` |
| Oscuro | Solo con `prefers-color-scheme: dark` | Bloque `@media (prefers-color-scheme: dark)` con valores propios (no es una inversión del claro) |

- `index.html` declara `<meta name="color-scheme" content="light dark">` y `:root` declara `color-scheme: light dark`, para que el navegador adapte sus controles y el lienzo inicial.
- No hay interruptor de tema en la interfaz.
- Con `prefers-reduced-motion: reduce` todas las duraciones valen `0ms`.

## 2. Color

Los valores van en hexadecimal a propósito: la prueba [`tokens.contrast.test.ts`](../src/styles/tokens.contrast.test.ts) lee el archivo y comprueba cada pareja en los dos temas. Si agregas un token de texto o de superficie, agrégalo también a la prueba.

### 2.1 Neutros y texto

| Token | Uso |
|---|---|
| `--color-canvas` | Fondo de la página: casi blanco teñido hacia el petróleo |
| `--color-surface` | Paneles, tablas, campos |
| `--color-surface-sunken` | Zonas hundidas (encabezado de tabla, pistas de la banda) |
| `--color-surface-hover` | Fila o elemento bajo el puntero |
| `--color-border` | Separadores decorativos |
| `--color-border-strong` | Borde de campos y controles (≥ 3:1) |
| `--color-text` | Texto principal |
| `--color-text-muted` | Texto secundario (≥ 4.5:1 en toda superficie) |
| `--color-text-placeholder` | Marcador de posición (≥ 4.5:1) |
| `--color-text-disabled` | Texto deshabilitado (exento de contraste por WCAG) |

### 2.2 Shell del personal

| Token | Uso |
|---|---|
| `--color-shell` | Riel izquierdo en tinta petróleo profunda |
| `--color-shell-raised` | Bloques dentro del riel |
| `--color-shell-border` | Separadores del riel |
| `--color-shell-text`, `--color-shell-text-muted` | Texto sobre el riel |
| `--color-shell-active` | Elemento de navegación actual |
| `--color-shell-focus` | Anillo de foco sobre el riel (≥ 3:1 sobre `--color-shell`) |

### 2.3 Acción, foco y superficies del navegador

| Token | Uso |
|---|---|
| `--color-primary`, `-hover`, `-active` | Acción primaria (petróleo saturado) |
| `--color-primary-text` | Texto sobre la acción primaria |
| `--color-primary-subtle`, `-subtle-text` | Selección, pestaña activa, fondo de información |
| `--color-link` | Enlaces |
| `--color-focus` | Anillo de foco (`outline`, para que sobreviva a `forced-colors`) |
| `--color-selection`, `--color-selection-text` | `::selection` |
| `--color-caret` | `caret-color` |
| `--color-scrollbar-thumb`, `--color-scrollbar-track` | `scrollbar-color` (pulgar ≥ 3:1 sobre la pista y las superficies) |

### 2.4 Estados generales y crítico

| Token | Uso |
|---|---|
| `--color-success`, `-subtle` | Confirmaciones |
| `--color-warning`, `-subtle` | Advertencias no clínicas |
| `--color-info`, `-subtle` | Información |
| `--color-critical`, `-hover`, `-text`, `-subtle`, `-subtle-text` | Rojo de alerta, **reservado a alertas abiertas** y errores |
| `--color-simulated`, `-text`, `-border` | Aviso "Datos simulados" |

### 2.5 Rangos glucémicos

Colores del consenso internacional de TIR. Cada estado tiene cuatro tokens: `--color-range-<estado>` (relleno de segmento o marcador, ≥ 3:1 sobre las superficies), `-on` (texto sobre el relleno, ≥ 4.5:1), `-text` (texto del estado sobre superficies, ≥ 4.5:1) y `-subtle` (fondo de insignia).

| Estado | Token base | Color |
|---|---|---|
| Muy bajo | `--color-range-very-low` | Rojo profundo |
| Bajo | `--color-range-low` | Rojo |
| En rango | `--color-range-in-range` | Verde |
| Alto | `--color-range-high` | Ámbar |
| Muy alto | `--color-range-very-high` | Naranja |

- **Los umbrales numéricos no son tokens.** Llegan del perfil de metas del paciente en la API (`very_low_mg_dl`, `range_low_mg_dl`, `range_high_mg_dl`, `very_high_mg_dl`).
- Ningún rango se comunica solo con color: siempre van la etiqueta del estado, el valor y la unidad mg/dL. Muy bajo y bajo además difieren en luminosidad (≥ 1.5:1 entre sí).

## 3. Tipografía

| Token | Valor |
|---|---|
| `--font-sans` | Atkinson Hyperlegible Next (variable, autoalojada con `@fontsource-variable`) |
| `--font-mono` | Atkinson Hyperlegible Mono, **solo para mediciones** (glucosa, porcentajes, horas en tablas) |

Escala fija en `rem` (sin tipografía fluida, porque es interfaz de producto):

| Token | Tamaño | Uso |
|---|---|---|
| `--font-size-xs` | 13 px | Metadatos de tabla, leyendas |
| `--font-size-sm` | 14 px | Celdas y controles densos |
| `--font-size-md` | 16 px | Cuerpo |
| `--font-size-lg` | 18 px | Texto destacado, cuerpo del paciente |
| `--font-size-xl` | 22 px | Título de sección |
| `--font-size-2xl` | 28 px | Título de página |
| `--font-size-3xl` | 36 px | Medición destacada |
| `--font-size-4xl` | 48 px | Medición principal |

Pesos `--font-weight-regular` (400), `-medium` (500), `-semibold` (600), `-bold` (700), `-heavy` (800). Interlineado `--line-height-tight`, `-snug`, `-body`. Tracking `--tracking-tight`, `-normal`, `-wide`. Medida de prosa `--measure-prose` (68ch). Sin kicker ni eyebrow sobre los títulos. `body` usa `font-size-adjust: from-font` para que el respaldo no salte al cargar la fuente. Tablas, `<time>`, `<data>` y `.num` usan cifras tabulares.

## 4. Espacio, tamaños y forma

- Espacio en base 4 px: `--space-0`, `-1` (4), `-2` (8), `-3` (12), `-4` (16), `-5` (20), `-6` (24), `-8` (32), `-10` (40), `-12` (48), `-16` (64), `-20` (80).
- Controles: `--control-height-sm` (32 px, barras densas del personal), `-md` (40 px, por defecto en el personal), `-lg` (48 px, objetivo táctil del paciente).
- `--row-height` (46 px, filas del triage), `--rail-width`, `--topbar-height`, `--content-max`.
- Foco: `--focus-ring-width`, `--focus-ring-offset`. Borde: `--border-width`.
- Radios: `--radius-sm` (4), `-md` (6), `-lg` (10), `-pill`.
- Sombras con desplazamiento y desenfoque suave, teñidas de petróleo: `--shadow-sm`, `-md`, `-lg`.

## 5. Movimiento y capas

- Duraciones `--duration-instant` (80 ms), `-fast` (140), `-base` (200), `-slow` (280); curvas `--ease-out` (exponencial) y `--ease-in-out`. El movimiento comunica estado, nunca decora.
- Capas: `--z-base`, `-raised`, `-sticky`, `-rail`, `-overlay`, `-toast`.

## 6. Puntos de quiebre (container queries)

El diseño se hace a 1440 px y se adapta hacia abajo hasta 360 px. Los componentes responden al ancho de su contenedor (`container-type: inline-size`), no al de la ventana.

| Token | Valor |
|---|---|
| `--bp-compact` | 40rem (640 px) |
| `--bp-medium` | 64rem (1024 px) |
| `--bp-wide` | 90rem (1440 px) |

CSS no permite `var()` dentro de la condición de `@container` ni de `@media`. Por eso estos tokens son de referencia: cada regla escribe el mismo literal, por ejemplo `@container (min-width: 64rem)`, y quien cambie un valor lo cambia en todas las reglas (`grep -rn "64rem" src`).

## 7. Superficies del navegador

`base.css` tematiza lo que no dibujamos: `::selection`, `caret-color`, `accent-color`, `scrollbar-color` (con respaldo `::-webkit-scrollbar` solo donde no existe), `::placeholder`, el desplazamiento del subrayado de los enlaces y un único anillo de foco con `outline` (que se respeta en `forced-colors`).

## 8. Cómo agregar un token

1. Agrégalo en `:root` y en el bloque oscuro de `tokens.css`, en hexadecimal si es un color.
2. Si es texto o superficie, agrégalo a las listas de `tokens.contrast.test.ts`.
3. Documéntalo en este archivo.
4. Muéstralo en la pantalla `/dev/system`.
