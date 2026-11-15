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

## Despliegue en Railway

La configuración está fijada en código (`railway.json` en la raíz), así que no depende de ajustes manuales de la interfaz:

| Ajuste en Railway | Valor | Por qué |
|---|---|---|
| **Root Directory** | **vacío (por defecto)** | El `Dockerfile` está en la raíz del repo y hace `COPY package.json`, `COPY packages/...` y `COPY apps/web/...` desde el contexto de build. Si se pusiera `apps/web`, el contexto se recortaría a esa carpeta y el build fallaría al no encontrar `packages/database`, `packages/shared-types` ni el `package-lock.json` raíz. |
| Builder | `DOCKERFILE` (fijado en `railway.json`) | Evita que Railway intente Railpack/Nixpacks sobre un monorepo. |
| Healthcheck | `/api/health` (fijado en `railway.json`) | Endpoint liviano que no toca la DB ni servicios externos. |
| Start command | no definir | El `Dockerfile` ya tiene `CMD ["node", "apps/web/server.js"]` y respeta `PORT`. |

### Pasos

1. Crea el proyecto en Railway y apúntalo al repo `OrbitStreet` (rama `main`).
2. Agrega el plugin **PostgreSQL**: Railway inyecta `DATABASE_URL` automáticamente en las variables del servicio.
3. Variables del servicio: `DATABASE_URL` (automática), `NODE_ENV=production` y, **opcionalmente**, `GEMINI_API_KEY` (si no está, la IA se oculta y se muestra el resumen determinista local).
4. **Una sola vez**, aplica el esquema a la base de datos de Railway desde tu máquina (el runtime de la imagen no incluye la CLI de Prisma):

   ```bash
   DATABASE_URL="<la URL pública de Railway>" npx prisma db push --schema packages/database/prisma/schema.prisma
   ```

   En PowerShell: `$env:DATABASE_URL="postgresql://..."; npx prisma db push --schema packages/database/prisma/schema.prisma`
5. Genera un dominio público en **Settings → Networking** y verifica `https://<tu-dominio>/api/health` (debe responder `{"status":"ok"}`).

> Nota: Railway escucha el puerto que define `PORT`; el contenedor ya arranca en `0.0.0.0`, requisito de la plataforma.

### Probar la imagen Docker localmente

El contenedor sirve una **instantánea congelada** del build: si cambias código y solo haces `docker run`, seguirás viendo la versión anterior. Tras cualquier cambio:

```bash
docker build -t orbitstreet-web:latest .
docker rm -f orbitstreet-ci
docker run -d --name orbitstreet-ci -p 3100:3000 \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/orbitstreet" \
  -e NODE_ENV=production orbitstreet-web:latest
# verificar: http://localhost:3100/api/health y http://localhost:3100/es
```

> Si ves el diseño o el contenido antiguo en el navegador, fuerza la recarga con `Ctrl+Shift+R` (los assets de Next llevan hash, pero el HTML puede quedar cacheado).

## Licencia

Apache-2.0. Ver [LICENSE](./LICENSE).
