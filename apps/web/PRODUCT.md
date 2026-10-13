# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Fase interna: un solo operador, Tomi Reig, fundador de 88RECORDS®. Maneja desde la compu todas las cuentas de TikTok del sello y de sus artistas (Argentina, Chile, Puerto Rico): sube videos, arma la semana de publicaciones y revisa qué salió. Desde el celular aprueba propuestas y mira estados. Fase 2 (SaaS): artistas independientes de LatAm manejando sus propias cuentas; todavía no definido en detalle.

## Product Purpose

Panel de marketing que hace el trabajo en vez de explicarlo. El primer módulo es el panel multicuenta de TikTok: conectar entre 5 y 15 cuentas por OAuth, cargar videos a una biblioteca, programarlos en un calendario por cuenta y que se publiquen solos, con el estado real de cada publicación. Éxito: la semana de todas las cuentas se arma en minutos y nada se publica sin aprobación.

## Positioning

Lo arma un sello independiente para su propia operación diaria, con las restricciones reales de las APIs a la vista. Toda recomendación se convierte en una acción que el usuario aprueba; nada de checklists ni carga manual de datos.

## Operating Context

- Sesiones largas en la compu (calendario, biblioteca, reglas por cuenta) y cortas en el celular (bandeja de aprobación, estados).
- Las publicaciones salen desde un worker que corre en la PC de Tomi; si la PC está apagada, los jobs esperan.
- Hora de referencia: Buenos Aires.
- Flujo: conectar cuenta → subir videos → arrastrar al calendario o "Autollenar semana" → aprobar en la pantalla de publicación → seguir estado (Procesando, En borradores, Publicado, Error).

## Capabilities and Constraints

- TikTok Content Posting API: sin auditoría, hasta 5 cuentas publican por día y todo sale privado (`SELF_ONLY`). Modo borrador manda el video a la bandeja de la app de TikTok. Se muestra en la UI, no se esconde.
- Pantalla de publicación obligatoria por TikTok: nickname de la cuenta, privacidad sin valor por defecto (solo opciones de `creator_info`), comentarios/dúo/stitch apagados por defecto, divulgación de contenido comercial, consentimiento con link a la Music Usage Confirmation, preview sin marcas de agua.
- Tope de publicaciones por día por cuenta (TikTok ronda 15, compartido entre apps). Aviso de archivo duplicado entre cuentas por hash.
- Prohibido: guardar contraseñas, automatizar logins, crear cuentas, simular actividad.
- Presupuesto USD 0: planes gratuitos.
- Idioma: español rioplatense (voseo), natural. Código en inglés.

## Brand Commitments

- Nombre siempre **88RECORDS®**; productos internos con ™.
- Colores de marca: naranja `#FF4D00` y ultramarino `#1E1EE6`, usados como luz (acentos, estados, brillos), no como relleno.
- Dirección pedida en CLAUDE.md: base oscura con profundidad, superficies en capas, tipografía sans geométrica/grotesca + monoespaciada para números y horas, movimiento con sentido, 60 fps, respeto por `prefers-reduced-motion`. Prohibido el look genérico de plantilla SaaS (violeta-azul, tarjetas dentro de tarjetas, íconos en cuadradito arriba de cada título, Inter para todo).

## Evidence on Hand

No hay métricas, testimonios ni casos cargados todavía. No inventar artistas, cuentas ni números en la UI: los estados vacíos dicen qué hacer.

## Product Principles

1. El usuario aprueba, el sistema ejecuta: cada propuesta muestra qué va a pasar, una vista previa y por qué.
2. Realidad de las APIs a la vista: límites y modos se muestran con claridad, nunca se disimulan.
3. Nada de pantallas de mentira: si algo no está conectado, se dice.
4. Rápido de operar para una sola persona con muchas cuentas: densidad, atajos, arrastrar y soltar.

## Accessibility & Inclusion

Sin requisitos específicos confirmados. Base: contraste AA, foco visible, navegación por teclado y `prefers-reduced-motion`.
