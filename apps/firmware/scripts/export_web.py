"""
OrbitStreet — Exporta los binarios del firmware para flasheo Web Serial.

Copia bootloader/partitions/boot_app0/firmware de las builds de PlatformIO
a apps/web/public/firmware/<board>/ y genera el manifest.json que consume
ESP Web Tools (https://esphome.github.io/esp-web-tools/) desde /flash.

IMPORTANTE: también exporta la partición de datos (spiffs.bin, imagen
LittleFS generada con 'pio run -e <env> -t buildfs') que contiene el
dashboard web del nodo. Sin ella, el flasheo web deja el ESP32 sin
interfaz (solo firmware) y 192.168.4.1 responde 404.

Uso (después de compilar AMBOS entornos y sus filesystems):
    pio run -e esp32dev -t buildfs
    pio run -e esp32-c3-devkitm-1 -t buildfs
    python scripts/export_web.py

Los .bin quedan versionados en el repo (ruta pública de la app web) para
que Railway los sirva sin necesidad de compilar PlatformIO en el deploy.
"""
import json
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
FIRMWARE = os.path.dirname(HERE)
WEB_PUBLIC = os.path.normpath(
    os.path.join(FIRMWARE, "..", "web", "public", "firmware")
)

# (env de PlatformIO, carpeta destino, offset del bootloader, offset spiffs)
BUILDS = [
    ("esp32dev", "esp32dev", 0x1000, 0x290000),
    ("esp32-c3-devkitm-1", "esp32-c3", 0x0, 0x290000),
]

PARTITIONS_OFFSET = 0x8000   # 32768
BOOT_APP0_OFFSET = 0xE000    # 57344
FIRMWARE_OFFSET = 0x10000     # 65536


def find_boot_app0():
    """boot_app0.bin vive en el paquete del framework Arduino ESP32."""
    pio_packages = os.path.join(
        os.path.expanduser("~"), ".platformio", "packages"
    )
    for pkg in os.listdir(pio_packages):
        if not pkg.startswith("framework-arduinoespressif32"):
            continue
        candidate = os.path.join(
            pio_packages, pkg, "tools", "partitions", "boot_app0.bin"
        )
        if os.path.exists(candidate):
            return candidate
    return None


def main():
    build_dir = os.path.join(FIRMWARE, ".pio", "build")
    boot_app0 = find_boot_app0()
    if not boot_app0:
        raise SystemExit("No se encontró boot_app0.bin en los paquetes de PlatformIO")

    manifest_builds = []
    for env, folder, bootloader_offset, spiffs_offset in BUILDS:
        src = os.path.join(build_dir, env)
        dst = os.path.join(WEB_PUBLIC, folder)
        os.makedirs(dst, exist_ok=True)

        for name in ("bootloader.bin", "partitions.bin", "firmware.bin"):
            s = os.path.join(src, name)
            if not os.path.exists(s):
                raise SystemExit(f"Falta {name}: compila primero con 'pio run -e {env}'")
            shutil.copy2(s, os.path.join(dst, name))
            print(f"{folder}/{name}: {os.path.getsize(s)} bytes")

        shutil.copy2(boot_app0, os.path.join(dst, "boot_app0.bin"))

        # Partición de datos: imagen LittleFS con el dashboard del nodo.
        # Generada por 'pio run -e <env> -t buildfs' (mismo tamaño que la
        # partición spiffs de default.csv: 0x160000).
        spiffs = os.path.join(src, "littlefs.bin")
        if not os.path.exists(spiffs):
            raise SystemExit(
                f"Falta littlefs.bin: ejecuta 'pio run -e {env} -t buildfs'"
            )
        shutil.copy2(spiffs, os.path.join(dst, "spiffs.bin"))
        print(f"{folder}/spiffs.bin: {os.path.getsize(spiffs)} bytes")

        manifest_builds.append({
            "chipFamily": "ESP32" if env == "esp32dev" else "ESP32-C3",
            "parts": [
                {"path": f"{folder}/bootloader.bin", "offset": bootloader_offset},
                {"path": f"{folder}/partitions.bin", "offset": PARTITIONS_OFFSET},
                {"path": f"{folder}/boot_app0.bin", "offset": BOOT_APP0_OFFSET},
                {"path": f"{folder}/firmware.bin", "offset": FIRMWARE_OFFSET},
                {"path": f"{folder}/spiffs.bin", "offset": spiffs_offset},
            ],
        })

    manifest = {
        "name": "OrbitStreet Ground Truth Node",
        "version": "0.2.0",
        "new_install_prompt_erase": True,
        "builds": manifest_builds,
    }
    manifest_path = os.path.join(WEB_PUBLIC, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print(f"manifest.json: {manifest_path}")


if __name__ == "__main__":
    main()
