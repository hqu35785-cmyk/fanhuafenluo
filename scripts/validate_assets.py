#!/usr/bin/env python3
"""Validate the complete static catalog, source PNGs, and generated previews."""

from __future__ import annotations

import json
import re
import struct
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data" / "works.js"
APP = ROOT / "src" / "app.js"
PREVIEW_ROOT = ROOT / "assets" / "previews"


def extract_array(source: str, name: str) -> list[dict]:
    match = re.search(rf"const\s+{re.escape(name)}\s*=\s*(\[[\s\S]*?\]);", source)
    if not match:
        raise AssertionError(f"Missing static array {name} in {DATA}")
    value = json.loads(match.group(1))
    if not isinstance(value, list):
        raise AssertionError(f"Catalog {name} is not an array")
    return value


def load_catalog() -> list[tuple[str, list[dict]]]:
    source = DATA.read_text(encoding="utf-8")
    latest = extract_array(source, "latestFanhuaWorks")
    fanhua = latest + extract_array(source, "fanhuaWorks")
    shark = extract_array(source, "sharkWorks")
    wa = extract_array(source, "waWorks")
    return [("繁花·纷落", fanhua), ("鲨鱼", shark), ("咓", wa)]


def asset_path(value: str) -> Path:
    if not isinstance(value, str) or not value.startswith("assets/"):
        raise AssertionError(f"Asset path is not repository-relative: {value!r}")
    decoded = Path(unquote(value))
    full = (ROOT / decoded).resolve()
    try:
        full.relative_to(ROOT.resolve())
    except ValueError as exc:
        raise AssertionError(f"Asset path escapes repository: {value!r}") from exc
    return full


def png_metadata_state(source: Path) -> tuple[int, bool]:
    data = source.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise AssertionError(f"Invalid PNG signature: {source}")
    offset = 8
    chara_chunks = 0
    found_iend = False
    while offset + 12 <= len(data):
        length = struct.unpack_from(">I", data, offset)[0]
        chunk_type = data[offset + 4 : offset + 8]
        data_start = offset + 8
        data_end = data_start + length
        chunk_end = data_end + 4
        if chunk_end > len(data):
            raise AssertionError(f"Truncated PNG chunk in {source}")
        if chunk_type == b"tEXt" and data[data_start:data_end].split(b"\0", 1)[0] == b"chara":
            chara_chunks += 1
        offset = chunk_end
        if chunk_type == b"IEND":
            found_iend = True
            break
    if not found_iend or offset != len(data):
        raise AssertionError(f"PNG IEND is missing or trailing bytes exist: {source}")
    return chara_chunks, found_iend


def webp_metadata_state(preview: Path) -> tuple[str, int, int]:
    """Validate the RIFF/WEBP container and read dimensions without Python imaging packages.

    Full decode validation is performed by the canonical Node validator
    (scripts/validate_assets.mjs) using the repository's sharp dependency.
    """
    data = preview.read_bytes()
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise AssertionError(f"Invalid WebP container: {preview}")
    offset = 12
    width = height = 0
    format_name = ""
    while offset + 8 <= len(data):
        chunk_type = data[offset : offset + 4]
        length = int.from_bytes(data[offset + 4 : offset + 8], "little")
        start = offset + 8
        end = start + length
        if end > len(data):
            raise AssertionError(f"Truncated WebP chunk: {preview}")
        chunk = data[start:end]
        if chunk_type == b"VP8X" and len(chunk) >= 10:
            format_name = "WEBP"
            width = 1 + int.from_bytes(chunk[4:7] + b"\0", "little")
            height = 1 + int.from_bytes(chunk[7:10] + b"\0", "little")
        elif chunk_type == b"VP8 " and len(chunk) >= 10 and chunk[3:6] == b"\x9d\x01\x2a":
            format_name = "WEBP"
            width = int.from_bytes(chunk[6:8], "little") & 0x3FFF
            height = int.from_bytes(chunk[8:10], "little") & 0x3FFF
        elif chunk_type == b"VP8L" and len(chunk) >= 5 and chunk[0] == 0x2F:
            format_name = "WEBP"
            bits = int.from_bytes(chunk[1:5], "little")
            width = (bits & 0x3FFF) + 1
            height = ((bits >> 14) & 0x3FFF) + 1
        offset = end + (length & 1)
    if not format_name or not width or not height:
        raise AssertionError(f"WebP dimensions could not be read: {preview}")
    return format_name, width, height


def main() -> None:
    if not DATA.is_file():
        raise AssertionError(f"Missing catalog: {DATA}")
    catalog = load_catalog()
    counts = {name: len(works) for name, works in catalog}
    expected_counts = {"繁花·纷落": 70, "鲨鱼": 14, "咓": 14}
    if counts != expected_counts:
        raise AssertionError(f"Expected {expected_counts}, found {counts}")
    if "const PREVIEW_LOAD_CONCURRENCY=3;" not in APP.read_text(encoding="utf-8"):
        raise AssertionError("Preview concurrency limit must remain 3")

    all_works = [work for _, works in catalog for work in works]
    name_aliases = [(str(work.get("name", "")), str(work.get("alias", ""))) for work in all_works]
    if len(name_aliases) != len(set(name_aliases)):
        raise AssertionError("Duplicate name/alias combinations found")
    image_refs = [str(work.get("image", "")) for work in all_works]
    if len(image_refs) != len(set(image_refs)):
        raise AssertionError("Duplicate source image paths found")

    new_sources = {
        asset_path("assets/tavo/new/Tavo_%E5%88%BB%E5%BE%8B%E5%BE%B7%E8%8F%88_7B5E.png"),
        asset_path("assets/tavo/new/Tavo_%E4%BA%91%E7%92%83_0DAC.png"),
        asset_path("assets/tavo/new/Tavo_%E9%9B%BE%E7%9F%A2%E8%91%B5_9813.png"),
    }
    expected_previews: set[Path] = set()
    source_bytes = 0
    preview_bytes = 0
    metadata_cards = 0
    for work in all_works:
        source = asset_path(work.get("image", ""))
        preview = asset_path(work.get("preview", ""))
        if source.suffix.lower() != ".png":
            raise AssertionError(f"Source is not PNG: {source}")
        if preview.suffix.lower() != ".webp":
            raise AssertionError(f"Preview is not WebP: {preview}")
        if not source.is_file():
            raise AssertionError(f"Missing source card: {source}")
        chara_chunks, found_iend = png_metadata_state(source)
        metadata_cards += int(found_iend and chara_chunks == 1)
        if source in new_sources and chara_chunks != 1:
            raise AssertionError(f"New PNG must contain exactly one chara chunk: {source}")
        if not preview.is_file():
            raise AssertionError(f"Missing preview: {preview}")
        image_format, image_width, image_height = webp_metadata_state(preview)
        if image_format != "WEBP":
            raise AssertionError(f"Preview is not WebP: {preview}")
        max_width, max_height = (640, 960) if source in new_sources else (960, 1440)
        if image_width > max_width or image_height > max_height:
            raise AssertionError(f"Preview exceeds {max_width}x{max_height}: {preview}")
        if preview.stat().st_size > 200 * 1024:
            raise AssertionError(f"Preview exceeds 200 KiB: {preview}")
        expected_previews.add(preview)
        source_bytes += source.stat().st_size
        preview_bytes += preview.stat().st_size

    actual_previews = set(PREVIEW_ROOT.rglob("*.webp"))
    if actual_previews != expected_previews:
        missing = expected_previews - actual_previews
        extra = actual_previews - expected_previews
        raise AssertionError(f"Preview set mismatch; missing={len(missing)}, extra={len(extra)}")
    if preview_bytes > 8 * 1024 * 1024:
        raise AssertionError("Combined preview budget exceeds 8 MiB")

    print(
        f"OK: {len(all_works)} source cards ({counts}), {len(actual_previews)} previews, "
        f"{source_bytes / 1024 / 1024:.2f} MiB source -> "
        f"{preview_bytes / 1024 / 1024:.2f} MiB preview "
        f"({preview_bytes / source_bytes:.1%}); "
        f"{metadata_cards}/{len(all_works)} sources contain one complete chara chunk"
    )


if __name__ == "__main__":
    main()
