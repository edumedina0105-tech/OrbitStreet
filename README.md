# OrbitStreet 🛰️🛣️

**ES:** *El cielo y tu calle.* Herramienta de ciencia ciudadana que convierte a cualquier
persona en **detective de tendencias del sistema Tierra**, usando datos reales de
[NASA POWER](https://power.larc.nasa.gov/) (MERRA-2): elige un lugar y una variable
(temperatura, lluvia, humedad) y la herramienta responde las cuatro preguntas del
detective — **qué** está cambiando, **dónde**, **cuánto** y si el cambio es
**estadísticamente significativo** (prueba de Mann-Kendall + pendiente de Sen, con
intervalo de confianza y corrección por comparaciones múltiples). Incluye una capa
opcional de hardware abierto (ESP32 + sensores de bajo costo) que lleva en su memoria
la línea base histórica de la NASA para tu ubicación y mide cuánto difiere *tu calle*
de la celda del satélite.

**EN:** *The sky and your street.* A citizen-science tool that turns anyone into an
**Earth System Trend Detective** using real NASA POWER data: pick any place and a
variable, and the tool answers the four detective questions — **what** is changing,
**where**, **by how much**, and whether the change is **statistically significant**
(Mann-Kendall test + Sen's slope, with confidence intervals and multiple-comparison
correction). An optional open-hardware layer (ESP32 + low-cost sensors) carries NASA's
historical baseline for your location in its own memory and measures how much *your
street* deviates from the satellite grid cell.

**Challenge:** *Be An Earth System Trend Detective!* — NASA Space Apps Challenge 2026.

---

## Stack

| Parte | Tecnología |
|---|---|
| `apps/web` | Next.js 15 (App Router, TypeScript), Tailwind CSS, next-intl (inglés/español, paridad 1:1) |
| `packages/database` | Prisma + PostgreSQL (fuente única de verdad del modelo de datos) |
| `packages/shared-types` | Interfaces TypeScript compartidas |
| `apps/firmware` *(Fase 2)* | PlatformIO, Arduino core para ESP32, C++17 |

## Estructura del monorepo

```
OrbitStreet/
├── apps/
│   ├── web/          # Frontend público + dashboard del detective (bilingüe en/es)
│   └── firmware/     # (Fase 2) Código embebido ESP32, PlatformIO
├── packages/
│   ├── database/     # Esquema Prisma, migraciones y cliente centralizado
│   └── shared-types/ # Tipos compartidos entre web y servidor
└── docs/            # Metodología y limitaciones (transparencia científica)
```

## Cómo ejecutarlo

Requisitos: Node.js 20+ y una base de datos PostgreSQL.

```bash
npm install
cp .env.example .env   # completar DATABASE_URL (y GEMINI_API_KEY si se quiere el informe IA)
npm run dev            # http://localhost:3000
```

## Variables de entorno

| Variable | Uso |
|---|---|
| `DATABASE_URL` | PostgreSQL (Prisma). Railway la provee automáticamente en despliegue. |
| `GEMINI_API_KEY` | Solo para redactar el "informe del detective" con números ya calculados. La IA nunca calcula cifras. |
| `NODE_ENV` | `development` o `production`. |

## Honestidad científica

- **NASA POWER es un reanálisis (MERRA-2)**, no medición satelital directa: se declara en la interfaz.
- **Estadística determinista:** Mann-Kendall, pendiente de Sen e intervalos de confianza se calculan matemáticamente en código (TypeScript), nunca con un modelo de lenguaje.
- Todo dato simulado o de prueba se muestra con la insignia **[DATOS SIMULADOS / TESTBED]**.
- Los datos comunitarios nunca se mezclan con los de la NASA sin etiqueta visible ("dato comunitario, no validado").
- Un sensor nuevo no puede probar una tendencia climática: la herramienta calcula cuántos años de datos serían necesarios.

## Licencia

Apache-2.0. Ver [LICENSE](./LICENSE).
