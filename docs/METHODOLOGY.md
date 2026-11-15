# OrbitStreet — Statistical Methodology

This document explains, in full, how OrbitStreet answers the four
detective questions — **what** is changing, **where**, **by how much**,
and whether the change is **statistically significant** — and what the
honest limitations of each step are. The statistics are computed
deterministically in code (TypeScript, unit-tested against
[pymannkendall](https://github.com/mmhs013/pyMannKendall) and SciPy);
an LLM is never used to produce or alter a number.

## 1. Data source

- **NASA POWER** (MERRA-2 reanalysis), daily point API, 1981 → present.
- POWER is a **reanalysis**, not a direct satellite measurement. The UI
  states this on every chart ("NASA POWER · MERRA-2 reanalysis").
- Missing values (`-999` fill) are **discarded**, never imputed.
- Series are cached in PostgreSQL (`PowerCache`), rounded to 0.01° to
  stabilize the cache key; API calls have a 15 s timeout + 1 retry so a
  live demo cannot hang.

## 2. From daily data to annual series

1. **Optional season filter** (`DJF | MAM | JJA | SON`). Seasonal
   filtering removes the annual cycle from the aggregate, as the
   challenge brief recommends.
2. **Annual aggregation** (per variable): mean (T2M, humidity), max
   (T2M_MAX), sum (precipitation), count above a threshold
   (days > 35 °C).

### Season convention (documented choice)

Seasons are grouped by **calendar year**: the DJF bucket of year *Y*
contains {Dec Y, Jan Y, Feb Y} — a contiguous 3-month winter window
ending in December of *Y*. This differs from the climatological
convention {Dec Y−1, Jan Y, Feb Y}; it is applied consistently
everywhere, which is what matters for trend detection. All season
windows close within their calendar year: MAM → May, JJA → August,
SON → November, DJF → December.

### Incomplete years are excluded (coverage rules)

A year enters the analysis only if:

1. **Its window has closed** relative to the end of the series. The
   current (in-progress) year is excluded — an 11-month "annual mean"
   or "annual total" would be seasonally biased. Concretely: the last
   year requires the series to reach the end month of its window
   (December for ALL/DJF; May, August or November for MAM/JJA/SON).
2. **Coverage ≥ 90 %** of the typical year size (the *mode* of year
   bucket sizes, which auto-adapts to daily ≈ 365, monthly ≈ 12, or
   season-filtered ≈ 90/3 points per year). Years with large data gaps
   are dropped rather than averaged over silently.

The reported analysis period is always the period **actually analyzed**:
if the last year was dropped, the UI does not claim the series extends
to the requested end date.

## 3. Trend detection

On the resulting annual series (one value per year):

- **Mann-Kendall test** (Mann 1945; Kendall 1975) with the **tie
  correction** for the variance of S. Rainfall and days-above-threshold
  series contain many ties; the correction is always applied.
- **Hamed-Rao (1998) variance correction** for autocorrelation, by
  default. Annual climate series are autocorrelated (ENSO and friends);
  without the correction, p-values are over-optimistic. The
  implementation is equivalent to
  `pymannkendall.hamed_rao_modification_test` (verified in
  `reference.test.ts` to 8 decimal places). Series with n < 6 fall
  back to the classic test.
- The reported p-value is two-sided. Significance uses α = 0.05 and
  requires a non-null trend direction.

## 4. Trend magnitude

- **Sen's slope** (Theil 1950; Sen 1968): the median of all
  N = n(n−1)/2 pairwise slopes. Robust to outliers and non-Gaussian
  residuals.
- **95 % confidence interval**: the classic non-parametric interval of
  Sen (1968) / Gilbert (1987, §16.4.2), computed from the ties-corrected
  Mann-Kendall variance:

  > Cα = z₁₋α/₂ · √varS → rank positions M₁ = (N − Cα)/2 and
  > M₂ = (N + Cα)/2 + 1, linearly interpolated on the ordered pairwise
  > slopes.

  We deliberately **do not bootstrap** the pairwise slopes: they share
  observations, so a naive resampling treats dependent values as
  independent and underestimates the variance. The classic
  order-statistic interval makes no such assumption. Slope and CI are
  validated against `scipy.stats.theilslopes` in `reference.test.ts`.
- Slopes are expressed **per decade** (slope × 10).

## 5. Multiple comparisons

When more than one hypothesis is tested at once, OrbitStreet applies
**Benjamini-Hochberg (1995)** FDR correction over that family and the
significance badge uses the adjusted p (`pFdr`):

- **A/B region comparator**: the two regions form one family of 2
  hypotheses; both reported p-values are BH-adjusted within that pair
  and the AI narration receives the adjusted values.
- Single-region analyses test a single hypothesis — no correction is
  claimed there.

## 6. "How many years would a sensor need?"

`yearsNeeded` estimates how many annual measurements a *local* sensor
would need to confirm the detected slope with 80 % power at α = 0.05.
It is the standard closed-form power calculation for a slope (OLS
slope variance Var(β̂) ≈ 12σ²/n³ for centered time indices):

> n ≈ ( √12 · (z₁₋α/₂ + z₁₋power) · σ / |slope| ) ^ (2/3)

where σ is the standard deviation of the annual residuals around the
Sen fit. The formula is validated by a deterministic Monte Carlo test
(400 simulated series; detection rate ≈ 80 %). It is an *estimate*: it
assumes independent annual residuals; a strongly autocorrelated local
series would need more years.

## 7. Community data and the ground-truth node

- Community observations and series are **never mixed with NASA data**
  without a provenance label. Point observations are cross-checked
  against the MERRA-2 cell of that day; the verdict
  (plausible / suspicious) is computed deterministically.
- The ESP32 node reports **ΔT = instantaneous reading − NASA monthly
  normal**. This is a difference against a **historical climatological
  reference** — useful to see how a street deviates from its long-term
  background — not a strict climate anomaly and not, by itself,
  evidence of local warming. Proving a multi-decadal trend is the job of
  the NASA series; the node's job is fresh, street-level, *certified*
  ground data.
- Station telemetry is authenticated with a per-station token (only its
  SHA-256 hash is stored), sanitized (≤ 60 records per batch,
  timestamps within [−7 d, +5 min] of server time, physical-range
  checks) and stored as UNVALIDATED until cross-checked.

## 8. What we do NOT do (by design)

- No simulated data without a **[SIMULATED / TESTBED]** badge.
- No LLM-computed statistics — the AI only narrates numbers that code
  already computed (and hides itself if no key is configured).
- No trend claimed from a single hot day, one warm reading, or an
  incomplete year.
- No mixing of daily and monthly data in one series.

## 9. Validation artifacts

- `apps/web/lib/stats/__tests__/reference.test.ts` — expected values
  generated by `apps/web/scripts/generate-reference-fixtures.py`
  (pymannkendall 1.4.2 + SciPy) on deterministic synthetic series
  (AR(1)+trend, tie-heavy rainfall-like, white noise).
- Monte Carlo power test for `yearsNeeded` (`years-needed.test.ts`).
- Unit tests for the tie correction, season windows, coverage rules,
  FDR order preservation, and determinism of every estimator
  (`apps/web/lib/stats/__tests__/`).
