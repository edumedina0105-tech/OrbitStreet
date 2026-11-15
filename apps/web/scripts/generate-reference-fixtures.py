"""
OrbitStreet — Generador de fixtures de referencia estadística.

Valida la implementación TypeScript del motor estadístico contra
pymannkendall (Mann-Kendall, Hamed-Rao) y scipy.stats.theilslopes
(IC de Sen) sobre series sintéticas DETERMINISTAS (numpy default_rng(42)).

Salida: JSON con las series y los valores esperados, que se incrustan en
apps/web/lib/stats/__tests__/reference.test.ts (tolerancia 1e-8).

Regenerar tras cambios intencionales:
    python apps/web/scripts/generate-reference-fixtures.py
"""
import json

import numpy as np
import pymannkendall as mk
from scipy import stats

rng = np.random.default_rng(42)

# 1. Serie AR(1) autocorrelacionada con tendencia (caso Hamed-Rao típico).
n = 50
phi = 0.6
eps = rng.standard_normal(n)
ar1 = np.zeros(n)
for t in range(1, n):
    ar1[t] = phi * ar1[t - 1] + eps[t]
ar1 = ar1 + 0.05 * np.arange(n)

# 2. Serie con muchísimos empates (lluvia: ~50% de ceros) + tendencia.
ties = np.where(
    rng.random(60) < 0.5, 0.0, rng.gamma(2.0, 5.0, 60)
) + 0.5 * np.arange(60)

# 3. Ruido blanco puro (sin tendencia real).
white = rng.standard_normal(30)

fixtures = {}
for name, x in [("ar1", ar1), ("ties", ties), ("white", white)]:
    orig = mk.original_test(x)
    hr = mk.hamed_rao_modification_test(x)
    ts = stats.theilslopes(x, np.arange(len(x)), 0.95)
    sen = mk.sens_slope(x)

    fixtures[name] = {
        "series": [float(v) for v in x],
        "original": {
            "s": float(orig.s),
            "varS": float(orig.var_s),
            "z": float(orig.z),
            "p": float(orig.p),
        },
        "hamedRao": {
            "varS": float(hr.var_s),
            "z": float(hr.z),
            "p": float(hr.p),
        },
        "theilslopes": {
            "slope": float(ts.slope),
            "lowSlope": float(ts.low_slope),
            "highSlope": float(ts.high_slope),
        },
        "senSlope": float(sen[0]),
    }

print(json.dumps(fixtures, indent=2))
