#!/usr/bin/env python3
"""Generate lightweight gallery previews without touching source card metadata."""

from __future__ import annotations

import base64
import re
from pathlib import Path

from PIL import Image, ImageFile, ImageOps


# Some character-card PNGs contain application data after IEND. Browsers and
# download clients accept it, and previews only need the decoded pixel stream.
ImageFile.LOAD_TRUNCATED_IMAGES = True


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
INLINE_IMAGE = re.compile(
    br'const IMAGE="data:image/png;base64,([A-Za-z0-9+/=]+)";'
)
SOURCE_DIR = ROOT / "assets" / "source"
PREVIEW_DIR = ROOT / "assets" / "previews"
WANWAN_SOURCE = SOURCE_DIR / "wanwan.png"


def externalize_inline_image() -> None:
    data = INDEX.read_bytes()
    match = INLINE_IMAGE.search(data)
    if match:
        source_bytes = base64.b64decode(match.group(1), validate=True)
        SOURCE_DIR.mkdir(parents=True, exist_ok=True)
        if not WANWAN_SOURCE.exists() or WANWAN_SOURCE.read_bytes() != source_bytes:
            WANWAN_SOURCE.write_bytes(source_bytes)
        newline = b"\r\n" if b"\r\n" in data else b"\n"
        replacement = (
            b'const IMAGE_SOURCE="assets/source/wanwan.png";'
            + newline
            + b'const IMAGE_PREVIEW="assets/previews/wanwan.webp";'
        )
        INDEX.write_bytes(data[: match.start()] + replacement + data[match.end() :])
    elif not WANWAN_SOURCE.exists():
        raise RuntimeError("Inline source image is absent and assets/source/wanwan.png is missing")


def preview_path(source: Path) -> Path:
    if source == WANWAN_SOURCE:
        return PREVIEW_DIR / "wanwan.webp"
    relative = source.relative_to(ROOT / "assets" / "tavo")
    return (PREVIEW_DIR / "tavo" / relative).with_suffix(".webp")


def generate_preview(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original)
        image.thumbnail((960, 1440), Image.Resampling.LANCZOS, reducing_gap=3.0)
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")
        image.save(
            destination,
            format="WEBP",
            quality=82,
            method=6,
            exact=True,
        )


def main() -> None:
    externalize_inline_image()
    sources = [WANWAN_SOURCE, *sorted((ROOT / "assets" / "tavo").rglob("*.png"))]
    destinations = []
    for source in sources:
        destination = preview_path(source)
        generate_preview(source, destination)
        destinations.append(destination)

    missing = [path for path in destinations if not path.is_file()]
    if missing:
        raise RuntimeError(f"Missing {len(missing)} generated previews")

    preview_bytes = sum(path.stat().st_size for path in PREVIEW_DIR.rglob("*.webp"))
    print(
        f"Generated {len(sources)} previews; "
        f"total preview size {preview_bytes / 1024 / 1024:.2f} MiB"
    )


if __name__ == "__main__":
    main()
