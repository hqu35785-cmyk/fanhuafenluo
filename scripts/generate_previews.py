#!/usr/bin/env python3
"""Generate lightweight gallery previews without touching source card metadata."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageFile, ImageOps


# Some character-card PNGs contain application data after IEND. Browsers and
# download clients accept it, and previews only need the decoded pixel stream.
ImageFile.LOAD_TRUNCATED_IMAGES = True


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets" / "source"
PREVIEW_DIR = ROOT / "assets" / "previews"
WANWAN_SOURCE = SOURCE_DIR / "wanwan.png"


def ensure_wanwan_source() -> None:
    if not WANWAN_SOURCE.exists():
        raise RuntimeError("assets/source/wanwan.png is missing")


def preview_path(source: Path) -> Path:
    if source == WANWAN_SOURCE:
        return PREVIEW_DIR / "wanwan.webp"
    relative = source.relative_to(ROOT / "assets" / "tavo")
    return (PREVIEW_DIR / "tavo" / relative).with_suffix(".webp")


def generate_preview(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original)
        # Gallery cards are ~150–280 CSS px wide; 640w covers 2x retina without huge decode cost.
        image.thumbnail((640, 960), Image.Resampling.LANCZOS, reducing_gap=3.0)
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")
        image.save(
            destination,
            format="WEBP",
            quality=74,
            method=6,
            exact=True,
        )


def main() -> None:
    ensure_wanwan_source()
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
