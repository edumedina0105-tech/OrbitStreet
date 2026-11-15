# Expediente Paraguay — ¿Está aumentando el calor extremo?

**OrbitStreet · NASA Space Apps Challenge 2026**

A real, fully reproducible investigation produced with OrbitStreet's
deterministic engine on real NASA POWER (MERRA-2) data. Every number below
was recomputed server-side and independently verified against
pymannkendall 1.4.2 and SciPy on the same data (agreement to 8 decimals).

## The three questions

### 1. Has the mean annual temperature of Asunción changed?

**No significant trend (1981–2025, 45 complete years).**

| Statistic | Value |
|---|---|
| Sen's slope | **−0.001 °C/decade** · 95 % CI [−0.187, +0.173] |
| Mann-Kendall p | **0.992** (Hamed-Rao autocorrelation correction) |
| Verdict | 🟡 Not significant |

> Live dossier: [/es/dossier?lat=-25.26&lon=-57.53&variable=T2M&season=ALL&startYear=1981&endYear=2025](https://orbitstreet.up.railway.app/es/dossier?lat=-25.26&lon=-57.53&variable=T2M&season=ALL&startYear=1981&endYear=2025&place=Asunci%C3%B3n)

An honest null result: the MERRA-2 grid cell containing Asunción shows no
monotonic trend in annual mean temperature over 45 years. (The cell's
interannual variance is dominated by ENSO cycles.)

### 2. Is the frequency of days above 35 °C increasing in Asunción?

**No significant trend (1981–2025, days/year counted from daily T2M_MAX).**

| Statistic | Value |
|---|---|
| Mean days > 35 °C | 62.4 days/year (1981: 29 · 2025: 86) |
| Sen's slope | **−2.775 days/decade** · 95 % CI [−10.71, +4.59] |
| Mann-Kendall p | **0.451** |
| Verdict | 🟡 Not significant |

> Live dossier: [/es/dossier?lat=-25.26&lon=-57.53&variable=DAYS_ABOVE_THRESHOLD&season=ALL&startYear=1981&endYear=2025](https://orbitstreet.up.railway.app/es/dossier?lat=-25.26&lon=-57.53&variable=DAYS_ABOVE_THRESHOLD&season=ALL&startYear=1981&endYear=2025&place=Asunci%C3%B3n)

The year-to-year swings (29 → 86 → … days) are large; the Sen slope is
slightly negative and its confidence interval comfortably spans zero.
**Independent check**: counting the same days from the same NASA POWER
T2M_MAX series and running pymannkendall yields slope −2.775 days/decade,
p = 0.4511 — identical to OrbitStreet's engine.

### 3. Does the Chaco warm faster than Asunción?

**No significant difference between the two cells (1981–2025).**

| Cell | Sen's slope (T2M) | 95 % CI | Mann-Kendall p |
|---|---|---|---|
| Asunción (−25.26, −57.53) | −0.001 °C/dec | [−0.187, +0.173] | 0.992 |
| Mariscal Estigarribia, Chaco (−22.03, −60.62) | **−0.072 °C/dec** | [−0.286, +0.134] | 0.451 |

> Live dossier (Chaco): [/es/dossier?lat=-22.03&lon=-60.62&variable=T2M&season=ALL&startYear=1981&endYear=2025](https://orbitstreet.up.railway.app/es/dossier?lat=-22.03&lon=-60.62&variable=T2M&season=ALL&startYear=1981&endYear=2025&place=Mariscal%20Estigarribia%20(Chaco))

When two regions are compared in the A/B comparator, both p-values are
Benjamini-Hochberg-adjusted within the pair (family of 2 hypotheses) —
neither cell shows a trend, adjusted or raw.

## Why an honest "no trend" is the finding

* The tool does not manufacture drama: at these grid cells, at the annual
  scale, 1981–2025, MERRA-2 shows no significant warming — and saying so
  **is** the scientifically correct answer.
* A single hot day, a heatwave year, or a street sensor reading cannot
  establish a climate trend; that is why OrbitStreet quantifies **how many
  years a new local sensor would need** (Monte Carlo-validated power
  formula) before its measurements could confirm one.
* Everything above is recomputable by anyone: each dossier URL re-runs the
  deterministic analysis server-side; the tests
  (`apps/web/lib/stats/__tests__/reference.test.ts`) pin the engine against
  pymannkendall/SciPy; the verification scripts
  (`apps/web/scripts/verify-real-data.py`,
  `apps/web/scripts/verify-days-above35.py`) re-derive the headline numbers
  from raw NASA POWER data.

## Limitations (declared, not hidden)

* NASA POWER is a **reanalysis** (MERRA-2), not direct satellite
  measurement.
* The grid is **0.5° × 0.5° (~50 km)**: results describe the grid cell, not
  a specific street.
* Only complete years (≥ 90 % coverage) enter the analysis.
* Method details: [docs/METHODOLOGY.md](./METHODOLOGY.md).