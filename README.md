# OrbitStreet 🛰️🛣️

**The sky and your street.** A citizen-science tool that turns anyone into an
**Earth System Trend Detective** using real [NASA POWER](https://power.larc.nasa.gov/)
data (MERRA-2 reanalysis): pick any place and a variable — temperature,
rainfall, humidity — and the tool answers the four detective questions:
**what** is changing, **where**, **by how much**, and whether the change is
**statistically significant** (Mann-Kendall with tie and autocorrelation
[Hamed-Rao] corrections + Sen's slope with a classic non-parametric 95 %
confidence interval; Benjamini-Hochberg FDR correction when multiple
hypotheses are tested at once).

**Live demo:** **https://orbitstreet.up.railway.app** (bilingual English/Spanish)

**Challenge:** *Be An Earth System Trend Detective!* — NASA Space Apps
Challenge 2026.

An optional open-hardware layer (**completed and browser-flashable**) lets
anyone turn a ~$5 ESP32 into a certified ground-truth node: it carries
NASA's monthly normals for its own location in flash memory, measures how
much *your street* deviates from the satellite grid cell (ΔT vs the
historical reference), and sends token-signed telemetry to the platform.
Flash it straight from the browser with Web Serial — no toolchain needed:
[`/en/flash`](https://orbitstreet.up.railway.app/en/flash).

## Scientific honesty

- **NASA POWER is a reanalysis (MERRA-2)**, not a direct satellite
  measurement — declared in the UI on every chart.
- **Deterministic statistics:** every number (Mann-Kendall, Sen's slope,
  confidence intervals, FDR) is computed mathematically in code and
  unit-tested against [pymannkendall](https://github.com/mmhs013/pyMannKendall)
  and SciPy. An LLM never computes or alters a figure — the AI only
  narrates results that code already calculated (and hides itself when no
  key is configured).
- **Incomplete years are excluded:** the current year and any year with
  < 90 % data coverage never contaminate means, precipitation totals or
  extreme-day counts.
- **Autocorrelation is corrected** (Hamed-Rao 1998) so p-values don't
  come out over-optimistic on ENSO-flavored series.
- All simulated or test data is shown with a **[SIMULATED / TESTBED]**
  badge; community data is never mixed with NASA data without a
  provenance label.
- A new sensor cannot prove a climate trend — the tool computes
  **how many years of measurements it would need** (Monte Carlo-validated
  power formula), and the ESP32's ΔT is always described as a difference
  against a historical monthly normal, not a climate anomaly.

Full methodology, formulas and limitations:
**[docs/METHODOLOGY.md](./docs/METHODOLOGY.md)**.

## Case study: "Is extreme heat increasing in Paraguay?"

A real, fully reproducible investigation answering three questions
(mean temperature, days > 35 °C, Chaco vs Asunción) on real NASA POWER data
— with an honest null result and every number independently verified
against pymannkendall/SciPy:
**[docs/CASE_PARAGUAY.md](./docs/CASE_PARAGUAY.md)**.

## Stack

| Part | Technology |
|---|---|
| `apps/web` | Next.js 15 (App Router, TypeScript), Tailwind CSS, next-intl (English/Spanish, 1:1 parity) |
| `packages/database` | Prisma + PostgreSQL (single source of truth for the data model) |
| `packages/shared-types` | Shared TypeScript interfaces |
| `apps/firmware` | PlatformIO, Arduino core for ESP32, C++ — complete (sensor drivers, captive-portal wizard, signed telemetry, NASA baseline, Web Serial flashing) |

## Monorepo layout

```
OrbitStreet/
├── apps/
│   ├── web/          # Public frontend + detective dashboard (bilingual en/es)
│   └── firmware/     # ESP32 firmware (PlatformIO): /flash flashes it from the browser
├── packages/
│   ├── database/     # Prisma schema, migrations, centralized client
│   └── shared-types/ # Types shared by web and firmware docs
└── docs/
    ├── METHODOLOGY.md          # Statistics, conventions, limitations (transparency)
    ├── CASE_PARAGUAY.md        # Real reproducible investigation on Paraguay heat
    └── PLAN_IMPLEMENTACION.md  # Internal implementation notes (Spanish)
```

## Run it locally

Requirements: Node.js 20+ and a PostgreSQL database.

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL (and GEMINI_API_KEY for the AI narration)
npm run dev            # http://localhost:3000
```

Run the test suite (147 tests, including validation against pymannkendall/SciPy
and a Monte Carlo power check):

```bash
npm test --workspace apps/web
```

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL (Prisma). Railway injects it automatically on deploy. |
| `GEMINI_API_KEY` | Optional. Only narrates the detective report with numbers already computed. The AI never computes figures; without a key it hides itself and a deterministic local summary is shown. |
| `NODE_ENV` | `development` or `production`. |

## Deploying to Railway

The configuration is fixed in code (`railway.json` at the repo root), so it
does not depend on manual UI settings:

| Railway setting | Value | Why |
|---|---|---|
| **Root Directory** | **empty (default)** | The `Dockerfile` sits at the repo root and runs `COPY package.json`, `COPY packages/...` and `COPY apps/web/...` from the build context. Setting `apps/web` would cut the context down to that folder and break the build (missing `packages/database`, `packages/shared-types`, root `package-lock.json`). |
| Builder | `DOCKERFILE` (fixed in `railway.json`) | Prevents Railway from trying Railpack/Nixpacks on a monorepo. |
| Healthcheck | `/api/health` (fixed in `railway.json`) | Lightweight endpoint that touches neither the DB nor external services. |
| Start command | leave unset | The `Dockerfile` already has a `CMD` and respects `PORT`. |

### Steps

1. Create the Railway project and point it at this repo (branch `main`).
2. Add the **PostgreSQL** plugin: Railway injects `DATABASE_URL` into the
   service variables automatically.
3. Service variables: `DATABASE_URL` (automatic), `NODE_ENV=production`, and
   **optionally** `GEMINI_API_KEY`.
4. Generate a public domain under **Settings → Networking** and check
   `https://<your-domain>/api/health` (it must answer `{"status":"ok"}`).

> **Automatic schema:** the container runs `prisma db push` (idempotent)
> right before starting the server, so tables are created on first deploy —
> no manual step against the Railway database. The first attempt runs
> without `--accept-data-loss` (blocking destructive changes); if Prisma
> only *warns* (e.g. adding a unique index), it retries accepting it so the
> app is never left down.

> Railway provides the port via `PORT`; the container already listens on
> `0.0.0.0` as the platform requires.

### Testing the Docker image locally

The container serves a **frozen snapshot** of the build: after changing
code, rebuild the image — a plain `docker run` keeps serving the previous
version.

```bash
docker build -t orbitstreet-web:latest .
docker rm -f orbitstreet-ci
docker run -d --name orbitstreet-ci -p 3100:3000 \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/orbitstreet" \
  -e NODE_ENV=production orbitstreet-web:latest
# verify: http://localhost:3100/api/health and http://localhost:3100/es
```

> If you see stale content after rebuilding, force a reload with
> `Ctrl+Shift+R` (Next assets are content-hashed, but the HTML itself can
> stay cached by the browser).

## License

Apache-2.0. See [LICENSE](./LICENSE).
