# Contrato de dirección visual (Insumap frontend)

Construcción código-primero (no hay generación de imágenes). Este contrato fija el mundo visual; DESIGN.md se escribe al final a partir de lo construido.

## Escena física
Médico en un consultorio con luz diurna o fluorescente, frente a un monitor de escritorio de 1440 a 1920 px, revisando pacientes entre consultas. Admin en una oficina, en un escritorio. Paciente en casa, en un portátil o en el celular. **Tema claro por defecto.** El tema oscuro solo se aplica con `prefers-color-scheme: dark`, con tokens propios, y nunca es el tema por defecto.

## Prioridad
Escritorio primero, de 1280 a 1920 px; se diseña a 1440 px. Después se adapta hacia abajo: la superficie del paciente sigue usable a 360 px con objetivos táctiles de 48 px.

## Tipografía
- **Atkinson Hyperlegible Next** para la UI y los títulos. Se eligió por su diseño de máxima legibilidad (Braille Institute), pensado para pacientes con baja visión y médicos que escanean rápido. Autoalojada con `@fontsource`.
- **Atkinson Hyperlegible Mono** solo para mediciones: valores de glucosa, porcentajes y horas en tablas, con cifras tabulares.
- Escala clara con saltos de peso evidentes. Sin kicker ni eyebrow sobre los títulos.

## Color: estrategia Committed en el shell
- **Shell:** riel de navegación y cabecera en una tinta petróleo profunda, que es dueña de la navegación del personal. El fondo es casi blanco, teñido hacia el petróleo; ni crema ni gris frío.
- **Acción primaria:** petróleo más brillante y saturado, con contraste AA.
- **Rangos glucémicos:** colores de estado con significado, alineados al consenso internacional de TIR: muy bajo y bajo en rojos, en rango en verde, alto en ámbar y muy alto en naranja. Son tokens; los umbrales numéricos llegan siempre de la API (perfil de metas). Ningún rango se comunica solo con color: siempre lleva etiqueta, valor y unidad mg/dL.
- **Crítico:** rojo de alerta, reservado a alertas abiertas.
- Selección de texto, caret, foco, scrollbars y subrayados tematizados desde la paleta.

## Movimiento característico: "la banda de rango"
El rango objetivo del paciente se dibuja como una banda horizontal que recorre el producto:
- En cada fila del triage: barra apilada compacta de TIR de 14 días, proporcional y con el % de cada tramo legible, más la última lectura ubicada sobre una regla de rango.
- En el detalle del paciente: la AGP con la banda objetivo sombreada.
- En el inicio del paciente: la última glucosa sobre la banda, con texto "en rango", "bajo" o "alto".
- En la landing: el héroe muestra el triage real funcionando con datos simulados (MSW), no una ilustración.

## Superficies
- **Landing (Persuade):**
  - Una línea clara de qué hace Insumap, sin frases poéticas.
  - La acción "Entrar a la demo" con selector de rol (Médico, Paciente, Admin de clínica) visible en el primer viewport.
  - Debajo, en secciones con ritmo propio (no una cuadrícula de tarjetas iguales): cómo llegan los pacientes (FHIR o CSV → credenciales → registros), cómo decide el médico sobre la IA (aprobar, modificar o rechazar con motivo), los hechos de seguridad y privacidad, y el aviso académico.
  - Nada de clientes, cifras ni testimonios inventados.
- **Dashboard del médico (Operate):**
  - Riel izquierdo.
  - La cola de triage domina: tabla ordenable por riesgo, con motivo, banda TIR de 14 días, última lectura y su hora, y alertas abiertas.
  - Panel lateral de alertas abiertas.
  - Detalle del paciente con AGP, métricas (TIR, TBR, TAR, CV, GMI) y sugerencias de IA rotuladas como pendientes, con aprobar, modificar o rechazar con motivo.
  - Denso: filas de 44 a 48 px.
- **Consola del admin (Operate):** riel izquierdo; importación (FHIR o CSV) con validación por fila, emisión y reenvío de credenciales, equipos de atención. Tablas estándar sin datos clínicos detallados.
- **Paciente (Operate):**
  - Barra superior.
  - Última glucosa sobre la banda y registro rápido de glucosa en 3 pasos.
  - Gráfica del día y de la semana, plan activo y recordatorios.
  - Objetivos táctiles grandes.
- **Acceso:** login, reto MFA (TOTP o código de respaldo), enrolamiento MFA con QR dibujado en el navegador y códigos de respaldo, y activación del paciente (código y fecha de nacimiento → contraseña y consentimiento). Aviso médico visible.

## Rechazos (del usuario)
Nada de aspecto de plantilla SaaS (tarjetas iguales, gradientes, hero genérico), frases poéticas ni información de poco valor. Tampoco modales sin necesidad, texto con gradiente, glass decorativo, bordes laterales de color en tarjetas ni emoji como iconos. Los iconos salen de una sola librería (Lucide).
