"""
OrbitStreet — gzip del dashboard embebido.

El ESP32 sirve data/index.html.gz desde LittleFS (menos flash + tráfico).
PlatformIO lo ejecuta automáticamente antes de cada build (extra_scripts).
"""
import gzip
import os

Import("env")  # noqa: F821  (provisto por SCons/PlatformIO)

DATA_DIR = os.path.join(env["PROJECT_DIR"], "data")

for name in os.listdir(DATA_DIR):
    if not name.endswith((".html", ".css", ".js")):
        continue
    src = os.path.join(DATA_DIR, name)
    dst = src + ".gz"
    with open(src, "rb") as fi:
        with gzip.open(dst, "wb", compresslevel=9) as fo:
            fo.write(fi.read())
    print("gzip: %s -> %s" % (name, name + ".gz"))
