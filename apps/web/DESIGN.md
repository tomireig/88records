---
name: 88RECORDS® Panel TikTok™
description: Panel oscuro de operación multicuenta; naranja como luz de acción, ultramarino como luz de selección.
colors:
  ink-0: "#08090c"
  ink-1: "#0d0f13"
  ink-2: "#12141a"
  ink-3: "#181b22"
  ink-4: "#20242d"
  line: "rgb(255 255 255 / 0.07)"
  line-strong: "rgb(255 255 255 / 0.13)"
  fg: "#eceef2"
  fg-2: "#a6abb7"
  fg-3: "#868c9c"
  orange: "#ff4d00"
  orange-hi: "#ff6a26"
  ultra: "#1e1ee6"
  ultra-hi: "#7070ff"
  ok: "#3ddc97"
  warn: "#ffb020"
  bad: "#ff5c5c"
  busy: "#8a8aff"
typography:
  headline:
    fontFamily: "Geist Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Geist Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"ss01\", \"cv11\""
  body-lg:
    fontFamily: "Geist Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Geist Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.33
  data:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "\"tnum\""
rounded:
  xs: "4px"
  sm: "6px"
  md: "9px"
  lg: "14px"
  full: "9999px"
spacing:
  "1": "4px"
  "1.5": "6px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
components:
  button-primary:
    backgroundColor: "{colors.orange}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.orange-hi}"
  button-secondary:
    backgroundColor: "{colors.ink-3}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.ink-4}"
  button-ghost:
    textColor: "{colors.fg-2}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-danger:
    textColor: "{colors.bad}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-sm:
    padding: "0 12px"
    height: "32px"
  input-field:
    backgroundColor: "{colors.ink-3}"
    textColor: "{colors.fg}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  nav-rail:
    backgroundColor: "{colors.ink-1}"
    width: "64px"
  nav-rail-item:
    textColor: "{colors.fg-3}"
    rounded: "{rounded.md}"
    size: "40px"
  post-chip:
    backgroundColor: "{colors.ink-3}"
    textColor: "{colors.fg-2}"
    rounded: "{rounded.xs}"
    padding: "4px"
  video-chip:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    padding: "6px"
  dialog:
    backgroundColor: "{colors.ink-2}"
    rounded: "{rounded.lg}"
  kbd:
    backgroundColor: "{colors.ink-3}"
    textColor: "{colors.fg-2}"
    rounded: "{rounded.xs}"
    padding: "1px 6px"
---

# Design System: 88RECORDS® Panel TikTok™

## Overview

**Creative North Star: "La consola de luz"**

Un instrumento de alta gama para una sola persona que opera muchas cuentas. La base es casi negra pero nunca plana: cinco capas de tinta fría (`ink-0` a `ink-4`) apiladas con bordes de 1px blancos a muy baja opacidad, y dos fuentes de luz muy tenues fijas sobre el fondo del body (ultramarino arriba a la izquierda, naranja arriba a la derecha). Sobre esa oscuridad, el color de marca no rellena: ilumina. El naranja es la luz de la acción (botón principal, foco, hoy, la estela que deja lo arrastrado); el ultramarino es la luz de la selección (celda destino, opción elegida, ítem marcado).

La densidad es de herramienta, no de folleto. El cuerpo dominante es de 13px, las horas, cupos y fechas van en Geist Mono con cifras tabulares, y la pantalla principal es una grilla de calendario con una fila por cuenta. Cada cuenta tiene su propio color, que aparece como anillo del avatar, filo izquierdo de cada bloque y un degradé suave en la cabecera de su fila. El vidrio aparece solo donde hay jerarquía: la barra superior pegajosa, el riel, la barra de pestañas del celular y los diálogos.

El movimiento tiene sentido operativo: springs en layout y diálogos, entradas escalonadas cortas de filas, un pulso suave en lo que se está publicando, shimmer en lugar de spinners para lo que se procesa. Todo se apaga con `prefers-reduced-motion`. El único fondo vivo está en el login. Rechazo confirmado: el look de plantilla SaaS (degradés violeta-azul, tarjetas dentro de tarjetas, íconos en cuadradito sobre cada título, Inter para todo).

**Key Characteristics:**
- Base de tinta fría en cinco capas, con bordes de 1px en lugar de sombras para separar superficies.
- Naranja = acción, ultramarino = selección; los dos se usan como luz (glow, filo, punto), casi nunca como relleno de superficie.
- Color propio por cuenta, presente en avatar, filo del bloque y cabecera de fila.
- Geist Sans para interfaz, Geist Mono tabular para todo número, hora o código.
- Estado como marca de 8px: llena = programado, hueca = propuesto, color = resultado.
- Movimiento con springs y pulsos suaves, siempre anulable por `prefers-reduced-motion`.

## Colors

Tinta fría casi negra, grises fríos para el texto y dos luces de marca con funciones que no se mezclan.

### Primary
- **Naranja Señal** (orange): la luz de la acción. Fondo del botón principal (con sombra inferior anaranjada), contorno de foco global, cursor de texto, el filo luminoso sobre la columna de hoy, el contador de la Bandeja, el ícono activo del riel y la estela del arrastre. **Naranja Señal Encendido** (orange-hi) es solo su hover.

### Secondary
- **Ultramarino Eléctrico** (ultra): la luz de la selección. Celda destino iluminada mientras se arrastra, checkbox marcado, opción de privacidad elegida, selección de texto. **Ultramarino Claro** (ultra-hi) es la versión legible sobre tinta: bordes de lo seleccionado, íconos de check, el anillo del glow ultramarino.

### Tertiary (estados)
- **Verde Publicado** (ok): publicado, cuenta activa, decisión hecha.
- **Ámbar Borrador** (warn): en borradores, por vencer, banner "Modo sin auditar".
- **Rojo Error** (bad): error, cuenta caída, acciones destructivas (solo borde y texto, nunca relleno pleno).
- **Lavanda Proceso** (busy): procesando o publicando; siempre acompañado del pulso suave.

### Neutral
- **Tinta 0** (ink-0): fondo de la página, cabeceras pegajosas a 80–90% de opacidad.
- **Tinta 1** (ink-1): riel, barra de pestañas, columna de biblioteca, pie fijo de los diálogos, celdas del mes.
- **Tinta 2** (ink-2): tarjetas de video, filas de bandeja, cuerpo del diálogo, agenda del celular.
- **Tinta 3** (ink-3): botón secundario, campos, bloques del calendario, tooltips, toasts.
- **Tinta 4** (ink-4): hover del secundario, pestaña activa del selector Semana/Mes, placeholders de miniatura.
- **Línea** (line) y **Línea Fuerte** (line-strong): todos los bordes de 1px. Línea separa zonas; Línea Fuerte delimita controles y elementos interactivos.
- **Texto** (fg), **Texto 2** (fg-2), **Texto 3** (fg-3): primario, secundario y terciario (etiquetas, ayudas, cifras de contexto).

### Paleta de cuentas
Cada cuenta elige su color de una paleta fija de ocho, definida en la vista de Cuentas: `#FF4D00`, `#4D5BFF`, `#00C2A8`, `#FFB000`, `#E04DFF`, `#4DB8FF`, `#FF4D8D`, `#9BE15D`. Se usa solo como identificación: anillo del avatar con halo, filo izquierdo del bloque, punto de 6px y degradé de cabecera de fila al 12% de opacidad.

### Named Rules
**The Light Not Fill Rule.** Naranja y ultramarino son luz: glow, filo, punto, contorno. El único relleno pleno naranja es el botón principal (y el contador de la Bandeja); el ultramarino solo rellena al 12–15% de opacidad o en el checkbox marcado.

**The Two Lights Rule.** Naranja significa "hacé esto"; ultramarino significa "esto está elegido o es el destino". No se intercambian.

**The Cool Ink Rule.** Ninguna superficie es negro plano. El fondo lleva las dos luces radiales fijas del body y las superficies suben por la escala de tinta.

## Typography

**Display Font:** no hay display; la marca 88RECORDS® se compone con Geist Sans en negrita.
**Body Font:** Geist Sans (con "Helvetica Neue", Arial, sans-serif), con `ss01` y `cv11` activados.
**Label/Mono Font:** Geist Mono (con ui-monospace, SFMono-Regular, monospace), siempre con cifras tabulares.

**Character:** una grotesca limpia y compacta para leer rápido, y una mono que convierte cada hora, cupo y fecha en algo que se escanea en columna.

### Hierarchy
- **Headline** (600, 17px, tracking -0.01em): título de cada pantalla en la barra superior (rango de la semana, "Biblioteca", "Bandeja").
- **Title** (600, 15px, tracking ajustado): título de diálogo. Los títulos de estado vacío usan 16px a peso 500.
- **Body** (400, 13px): el tamaño de trabajo. Nombres de cuenta y video, opciones, toggles, cuerpo de listas.
- **Body grande** (400, 14px): campos de formulario, botones medianos, párrafos de estado vacío.
- **Label** (400, 12px, en fg-3): cabeceras de columna, ayudas, metadatos, encabezados de día.
- **Data** (Geist Mono, 11–13px, tabular): horas en los bloques, "hoy 2/3", duraciones, conteos, fechas de la bandeja. Contadores de insignia a 10px.

### Named Rules
**The Mono Numbers Rule.** Toda hora, cifra, cupo, fecha numérica o código va en Geist Mono con `tabular-nums`. Las palabras van en Sans.

**The Sentence Case Rule.** La interfaz va en minúscula de oración. No hay etiquetas en mayúsculas ni sobre-títulos; la única excepción es el wordmark vertical 88RECORDS® del riel.

## Layout

Shell de tres zonas en escritorio: riel de íconos de 64px a la izquierda, área principal donde cada pantalla scrollea por dentro (la ventana no scrollea), y en el calendario una columna de biblioteca de 264px a la derecha desde `xl`. Los banners de estado (worker apagado, modo sin auditar, falta configuración) ocupan todo el ancho arriba del contenido, con borde inferior y tinte del tono.

La grilla semanal tiene una columna de cuenta de 176px y siete columnas de día; cada fila mide entre 76 y 200px y se estira para llenar el alto. Se mantiene un ancho mínimo de 960px con scroll horizontal. La vista mes es una grilla de 7 columnas con separadores de 1px (gap de 1px sobre fondo de línea).

Ritmo de espaciado en pasos de 4px: celdas a 6px, chips a 4–6px, barras superiores a 12px vertical y 16px horizontal (24px desde `md`), diálogos a 20px horizontal y 16px vertical, contenido de páginas de lista centrado con ancho máximo 1024px y padding de 16/24px.

En el celular el riel desaparece y aparece una barra de pestañas fija abajo (4 pestañas de 56px de alto, con safe-area), el calendario se convierte en agenda por día y la biblioteca lateral se oculta.

## Elevation & Depth

Profundidad por capas tonales y bordes de 1px; las sombras solo aparecen en lo que flota sobre el resto (diálogos, tooltips, lo que se arrastra) y como luz de color en lo activo. En reposo, nada en el flujo del dashboard lleva sombra.

### Shadow Vocabulary
- **Pop** (`box-shadow: 0 18px 50px -12px rgb(0 0 0 / 0.65), 0 2px 8px rgb(0 0 0 / 0.4)`): diálogos y tarjeta del login.
- **Lift** (`box-shadow: 0 10px 28px -8px rgb(0 0 0 / 0.6)`): tooltips del riel.
- **Glow naranja** (`box-shadow: 0 0 0 1px rgb(255 77 0 / 0.55), 0 8px 30px -6px rgb(255 77 0 / 0.45)`): el bloque o video mientras se arrastra.
- **Glow ultramarino** (`box-shadow: 0 0 0 1px rgb(112 112 255 / 0.7), 0 10px 34px -6px rgb(30 30 230 / 0.6)`): elemento seleccionado (opción de privacidad, propuesta seleccionada en la bandeja).
- **Celda destino** (`box-shadow: inset 0 0 0 1px rgb(112 112 255 / 0.8), inset 0 0 24px rgb(30 30 230 / 0.35)`): celda bajo el cursor durante un arrastre.

### Named Rules
**The Flat At Rest Rule.** Las superficies del dashboard son planas en reposo; la sombra negra es para lo que flota y la sombra de color es para lo que está activo.

**The Glass Where It Ranks Rule.** El desenfoque de fondo se reserva para la barra superior pegajosa, el riel, la barra de pestañas, los diálogos (con su overlay) y la tarjeta del login sobre el fondo vivo. No se aplica a tarjetas ni filas del dashboard.

## Shapes

Esquinas suaves y chicas, en escala corta: 4px para lo diminuto (bloques del calendario, propuestas, kbd, checkbox), 6px para las miniaturas dentro de los bloques, 9px para botones, campos, ítems del riel y tarjetas de video, 14px para diálogos, contenedores de lista y tarjetas de biblioteca. Avatares, switches, puntos de estado e insignias son círculos o píldoras. Todo borde es de 1px; los estados vacíos y las zonas para soltar usan borde punteado en Línea Fuerte (o naranja al 70% al soltar). Las miniaturas verticales mantienen proporción de video vertical (16×28px en bloques, 32×56px en la biblioteca lateral).

## Components

### Buttons
Táctiles y contenidos: responden con color y un hundimiento de 1px, nunca con escala.
- **Shape:** esquinas suaves (9px).
- **Primary:** relleno naranja con texto blanco a peso 500, brillo interior superior de 1px y sombra inferior anaranjada (`0 6px 20px -6px rgb(255 77 0 / 0.55)`). Uno por barra.
- **Hover / Focus:** hover a naranja encendido; activo baja 1px; foco con el contorno naranja global de 2px a 2px de distancia. Transición de 150ms.
- **Secondary:** tinta 3 con borde Línea Fuerte; hover a tinta 4 y borde blanco al 20%.
- **Ghost:** solo texto fg-2, hover con fondo blanco al 5%.
- **Danger:** texto y borde rojo al 30%, hover con fondo rojo al 10%.
- **Tamaños:** 36px (md, 14px) y 32px (sm, 13px). En carga, el ícono se reemplaza por un spinner y el botón queda deshabilitado al 45%.

### Chips (bloques del calendario)
- **Style:** tinta 3, borde Línea Fuerte, filo izquierdo del color de la cuenta, miniatura vertical, hora en mono 11px con su marca de estado y título en dos líneas.
- **State:** hover a tinta 4; publicado o en borradores al 70% y desaturado; error con borde rojo; mientras se arrastra el original queda al 30% y la copia flota girada -1.5° con borde naranja y glow naranja. Las propuestas son bloques con borde punteado y marca hueca.

### Cards / Containers
- **Corner Style:** 14px para listas y tarjetas de biblioteca; 9px para tarjetas de video y agenda.
- **Background:** tinta 1 al 60% para listas, tinta 2 para tarjetas.
- **Shadow Strategy:** ninguna en reposo (ver Elevation & Depth); la selección suma glow ultramarino.
- **Border:** Línea; hover a Línea Fuerte. Las filas internas se separan con divisores de Línea, no con tarjetas anidadas.
- **Internal Padding:** 12–16px.

### Inputs / Fields
- **Style:** 36px de alto, tinta 3, borde Línea Fuerte, 9px de radio, 14px, placeholder en fg-3. Fechas y horas en mono tabular.
- **Focus:** el contorno naranja global; el cursor de texto también es naranja.
- **Error / Disabled:** deshabilitado al 40–50% con cursor bloqueado; los errores se dicen en texto rojo debajo o en un banner.

### Toggles y selección
- **Switch:** píldora de 36×20px; apagado en tinta 4 con borde Línea Fuerte, prendido en naranja; la perilla blanca se desliza con spring (rigidez 700, amortiguación 40).
- **Checkbox:** 16px, tinta 3; marcado en ultramarino con borde ultramarino claro y un cuadrado blanco interior.
- **Opción de radio:** tarjeta de 40px; elegida con borde ultramarino claro, fondo ultramarino al 15%, check y glow ultramarino.

### Navigation
- **Riel (escritorio):** 64px, tinta 1 al 80% con desenfoque, marca "88®" arriba, ítems de ícono de 40px (trazo 1.8) con tooltip a la derecha al pasar o con foco. Activo: píldora con borde Línea Fuerte y blanco al 6% que se desliza entre ítems con spring compartido, ícono en naranja. Contador naranja en mono sobre la Bandeja. Abajo, el wordmark 88RECORDS® vertical en fg-3 y el avatar del usuario.
- **Barra de pestañas (celular):** fija abajo, cuatro columnas de 56px con ícono y etiqueta de 11px, activo en fg con ícono naranja.

### Diálogo
Vidrio oscuro (tinta 2 al 95% con desenfoque) con borde Línea Fuerte, sombra Pop y 14px de radio, anclado al 6% superior del alto y con máximo del 88%. Entra con spring (desde 14px abajo y 98% de escala). Cabecera con título y cierre, cuerpo que scrollea y un pie fijo en tinta 1 donde viven las acciones, que nunca quedan fuera de la vista.

### Avatar de cuenta
Círculo con anillo de 1.5px y halo del color de la cuenta; iniciales cuando no hay foto. Mientras la cuenta tiene algo publicándose, un segundo anillo exterior late suave (1.8s).

### Marca de estado
Punto de 8px en celda fija: lleno en fg = programado, hueco = propuesto, lavanda pulsante = procesando, ámbar = en borradores, verde = publicado, rojo = error, fg-3 = cancelado. Con etiqueta opcional de 12px.

### Arrastre (firma)
Al arrastrar, tres luces naranjas desenfocadas siguen al cursor con springs de distinto retraso (estela), la copia flota al costado del cursor y la celda destino se ilumina en ultramarino. Al soltar, 180ms con `cubic-bezier(0.16, 1, 0.3, 1)`. Sin estela con movimiento reducido.

### Banner de aviso
Franja de ancho completo con borde inferior, ícono de 16px y texto de 13px: ámbar al 6% para "Modo sin auditar", rojo al 7% para worker apagado, neutro para configuración faltante. Siempre visible, nunca descartable.

## Do's and Don'ts

### Do:
- **Do** separar superficies con la escala de tinta y bordes de 1px (Línea / Línea Fuerte) antes de pensar en sombras.
- **Do** usar naranja para la acción principal y el foco, y ultramarino para selección y destino de arrastre.
- **Do** poner toda hora, cifra y fecha numérica en Geist Mono con cifras tabulares.
- **Do** identificar cada cuenta con su color en avatar, filo de bloque y punto, nunca en fondos plenos.
- **Do** mostrar lo que se está procesando con el pulso suave (1.8s) o el shimmer, no con spinners de pantalla.
- **Do** usar springs para layout, diálogos y switches, y respetar `prefers-reduced-motion` en todo.
- **Do** mantener las acciones de un diálogo en su pie fijo.
- **Do** escribir la marca como 88RECORDS® y los productos internos con ™.

### Don't:
- **Don't** usar degradés violeta-azul, tarjetas dentro de tarjetas, íconos en cuadradito sobre cada título ni Inter para todo.
- **Don't** rellenar superficies grandes con naranja o ultramarino; son luz, no pintura.
- **Don't** usar negro plano como fondo.
- **Don't** poner etiquetas en mayúsculas ni sobre-títulos encima de los encabezados.
- **Don't** poner fondos vivos o animaciones decorativas dentro del dashboard; el fondo animado es exclusivo del login.
- **Don't** usar vidrio en tarjetas o filas; solo en barras pegajosas, riel, pestañas, diálogos y la tarjeta del login.
