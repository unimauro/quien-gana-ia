# ¿Quién gana con la IA?

Dashboard estático (GitHub Pages) que reúne, con fuente por cada dato, cuánto invierten las grandes tecnológicas en inteligencia artificial, si esa inversión se está pagando y quién gana hasta ahora: fabricantes de chips e infraestructura, gigantes de la nube, laboratorios y startups, o las empresas de software.

**En vivo:** https://unimauro.github.io/quien-gana-ia/ · **Corte de datos:** 13 de noviembre de 2026

## Qué contiene

- 42 empresas cotizadas (19 de chips e infraestructura, 9 gigantes, 14 de software y negocios) y 21 laboratorios y startups.
- Inversión de capital 2022–2026, flujo de caja libre, pedidos pendientes, valoraciones, ritmos de ingresos, compromisos de cómputo, financiamiento circular, deuda y eventos de 2026.
- 241 fuentes enlazadas (reportes de las empresas, StockAnalysis, Reuters, Bloomberg, FT, CNBC, entre otras).

## Estructura

| Ruta | Contenido |
|---|---|
| `index.html`, `styles.css`, `app.js`, `charts.js` | Página y gráficos (SVG/HTML, sin dependencias) |
| `data/raw/*.json` | Investigación original, con estado (`reported`, `guidance`, `press`, `estimate`) y URL por cifra |
| `etl/build.py` | Consolida `data/raw` en `data/dashboard.json`; no interpola y falla si falta un dato |
| `data/fuentes.txt` | Lista de URLs citadas |

Para regenerar los datos: `python3 etl/build.py` (solo biblioteca estándar).

## Límites

- No es asesoría financiera.
- La capitalización al 30-nov-2022 es un estimado (cierre de 2022 ajustado por precio).
- Las cifras de empresas privadas vienen de prensa, filtraciones y resúmenes de prospectos, no de estados auditados.
- Varias cifras del segundo semestre de 2026 vienen de medios secundarios; el detalle está en la sección «Método» de la página.
- La búsqueda de datos se hizo con asistencia de IA y se validó que los enlaces respondan (209 de 241 responden a una consulta automática; el resto bloquea robots).
