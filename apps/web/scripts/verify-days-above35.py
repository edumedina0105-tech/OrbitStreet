"""
Verificación independiente de la pregunta 2 del expediente Paraguay:
¿aumentan los días > 35 °C en Asunción? NASA POWER T2M_MAX diario,
conteo anual de días > 35 con años completos, pymannkendall + Sen.
"""
import json
import urllib.request
from collections import defaultdict

import numpy as np
import pymannkendall as mk
from scipy import stats

URL = (
    "https://power.larc.nasa.gov/api/temporal/daily/point"
    "?parameters=T2M_MAX&community=RE&longitude=-57.53&latitude=-25.26"
    "&start=19810101&end=20251231&format=JSON"
)
print("descargando POWER T2M_MAX Asunción...")
with urllib.request.urlopen(URL, timeout=60) as r:
    data = json.loads(r.read())

series = data["properties"]["parameter"]["T2M_MAX"]
by_year = defaultdict(list)
for k, v in series.items():
    if v == -999:
        continue
    by_year[int(k[:4])].append(v)

years = sorted(by_year)
sizes = {y: len(by_year[y]) for y in years}
mode = max(set(sizes.values()), key=list(sizes.values()).count)

counts = []
for y in years:
    if y == years[-1] and sizes[y] < mode * 0.9:
        continue
    if sizes[y] < mode * 0.9:
        continue
    counts.append(sum(1 for v in by_year[y] if v > 35.0))

x = np.array(counts, dtype=float)
orig = mk.original_test(x)
hr = mk.hamed_rao_modification_test(x)
sen = mk.sens_slope(x)
ts = stats.theilslopes(x, alpha=0.95)

print("años analizados:", len(x))
print(f"media de dias>35C: {x.mean():.1f} | primero: {counts[0]} | ultimo: {counts[-1]}")
print(f"Sen slope/decada: {sen[0]*10:+.3f} dias")
print(f"original:  z={orig.z:+.3f} p={orig.p:.4f}")
print(f"hamed_rao:  z={hr.z:+.3f} p={hr.p:.4f}")
print(f"IC Sen 95%: [{ts.low_slope*10:+.2f}, {ts.high_slope*10:+.2f}] dias/decada")
