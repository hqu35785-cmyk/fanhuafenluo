#!/usr/bin/env python3
"""Validate source cards, generated previews, and gallery loading invariants."""

from __future__ import annotations

import re
import struct
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
WANWAN_SOURCE = ROOT / "assets" / "source" / "wanwan.png"
PREVIEW_ROOT = ROOT / "assets" / "previews"


def tavo_sources(index_text: str) -> list[Path]:
    values = re.findall(r'\{image:"(assets/tavo/[^"]+\.png)"', index_text)
    if len(values) != len(set(values)):
        raise AssertionError("Duplicate TAVO source references found")
    return [ROOT / value for value in values]


def preview_for(source: Path) -> Path:
    if source == WANWAN_SOURCE:
        return PREVIEW_ROOT / "wanwan.webp"
    relative = source.relative_to(ROOT / "assets" / "tavo")
    return (PREVIEW_ROOT / "tavo" / relative).with_suffix(".webp")


def card_metadata_state(source: Path) -> tuple[int, bool]:
    data = source.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise AssertionError(f"Invalid PNG signature: {source}")
    offset = 8
    count = 0
    found_iend = False
    while offset + 12 <= len(data):
        length = struct.unpack_from(">I", data, offset)[0]
        chunk_type = data[offset + 4 : offset + 8]
        data_start = offset + 8
        data_end = data_start + length
        chunk_end = data_end + 4
        if chunk_end > len(data):
            break
        if chunk_type == b"tEXt" and data[data_start:data_end].split(b"\0", 1)[0] == b"chara":
            count += 1
        offset = chunk_end
        if chunk_type == b"IEND":
            found_iend = True
            break
    return count, found_iend


def main() -> None:
    index_text = INDEX.read_text(encoding="utf-8")
    sources = [WANWAN_SOURCE, *tavo_sources(index_text)]
    if len(sources) != 63:
        raise AssertionError(f"Expected 63 source cards, found {len(sources)}")
    if 'data:image/png;base64' in index_text:
        raise AssertionError("Large source PNG is still embedded in index.html")
    if "const PREVIEW_LOAD_CONCURRENCY=3;" not in index_text:
        raise AssertionError("Preview concurrency limit changed or is missing")

    expected_previews: set[Path] = set()
    source_bytes = 0
    preview_bytes = 0
    metadata_cards = 0
    for source in sources:
        if not source.is_file():
            raise AssertionError(f"Missing source card: {source}")
        chara_chunks, found_iend = card_metadata_state(source)
        metadata_cards += int(found_iend and chara_chunks == 1)
        if source == WANWAN_SOURCE and (not found_iend or chara_chunks != 1):
            raise AssertionError("Externalized Wanwan source lost its card metadata")
        preview = preview_for(source)
        expected_previews.add(preview)
        if not preview.is_file():
            raise AssertionError(f"Missing preview: {preview}")
        with Image.open(preview) as image:
            image.verify()
        with Image.open(preview) as image:
            if image.format != "WEBP":
                raise AssertionError(f"Preview is not WebP: {preview}")
            if image.width > 960 or image.height > 1440:
                raise AssertionError(f"Preview exceeds 960x1440: {preview}")
        if preview.stat().st_size > 200 * 1024:
            raise AssertionError(f"Preview exceeds 200 KiB: {preview}")
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
        f"OK: {len(sources)} source cards, {len(actual_previews)} previews, "
        f"{source_bytes / 1024 / 1024:.2f} MiB source -> "
        f"{preview_bytes / 1024 / 1024:.2f} MiB preview "
        f"({preview_bytes / source_bytes:.1%}); "
        f"{metadata_cards} sources contain one complete chara chunk"
    )


if __name__ == "__main__":
    main()
