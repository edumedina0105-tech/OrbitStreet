"""
Verificación independiente: NASA POWER T2M diario de Asunción
(-25.26, -57.53), 1981-2025, agregado a medias anuales con reglas de
cobertura (años completos), analizado con pymannkendall/scipy.
Compara con lo que produjo el motor de OrbitStreet.
"""
import json
import numpy as np
import pymannkendall as mk
import urllib.request
from collections import defaultdict

URL = (
    "https://power.larc.nasa.gov/api/temporal/daily/point"
    "?parameters=T2M&community=RE&longitude=-57.53&latitude=-25.26"
    "&start=19810101&end=20251231&format=JSON"
)
print("descargando POWER...")
with urllib.request.urlopen(URL, timeout=60) as r:
    data = json.loads(r.read())

series = data["properties"]["parameter"]["T2M"]
by_year = defaultdict(list)
for k, v in series.items():
    if v == -999:
        continue
    by_year[int(k[:4])].append(v)

years = sorted(by_year)
sizes = {y: len(by_year[y]) for y in years}
mode = max(set(sizes.values()), key=list(sizes.values()).count)
print("años:", len(years), "| puntos típicos/año (moda):", mode)
print("tamaños de los 3 últimos años:", {y: sizes[y] for y in years[-3:]})

# Reglas del motor: descartar el último año abierto (o < 90% cobertura).
annual = []
kept = []
for y in years:
    if y == years[-1] and sizes[y] < mode * 0.9:
        print("último año descartado por cobertura:", y, sizes[y])
        continue
    if sizes[y] < mode * 0.9:
        continue
    annual.append(float(np.mean(by_year[y])))
    kept.append(y)

x = np.array(annual)
print("n analizado:", len(x))

orig = mk.original_test(x)
hr = mk.hamed_rao_modification_test(x)
sen = mk.sens_slope(x)
ts = __import__("scipy.stats", fromlist=["theilslopes"]).theilslopes(x, alpha=0.95)

print(f"Sen slope/decada: {sen[0]*10:+.4f} degC")
print(f"original:  z={orig.z:+.3f} p={orig.p:.4f}")
print(f"hamed_rao:  z={hr.z:+.3f} p={hr.p:.4f}")
print(f"IC Sen 95%: [{ts.low_slope*10:+.4f}, {ts.high_slope*10:+.4f}] /decada")
