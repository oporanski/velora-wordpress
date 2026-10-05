#!/usr/bin/env python3
"""
Pure-Python .po → .mo compiler.

WP needs the binary `.mo` format (Uli Drepper's gettext layout) to load
translations at runtime — `.po` text files are source-only. Most CI machines
don't have `msgfmt` (gettext) installed, and shipping a Node toolchain just
for translation compilation is overkill, so we ship this tiny script.

Usage: python compile-mo.py path/to/file.po
       (writes path/to/file.mo next to the source)

Format reference: https://www.gnu.org/software/gettext/manual/html_node/MO-Files.html
"""

import struct
import sys
import re
from pathlib import Path


def parse_po(path: Path) -> dict[str, str]:
    """Parse a .po file into a {msgid: msgstr} dict.

    Skips fuzzy/obsolete entries. Joins multi-line strings.
    """
    text = path.read_text(encoding="utf-8")
    entries: dict[str, str] = {}

    msgid: list[str] | None = None
    msgstr: list[str] | None = None
    state: str | None = None  # "id" or "str"

    def flush() -> None:
        if msgid is None or msgstr is None:
            return
        # Empty msgid = header — keep so consumers can read metadata.
        entries["".join(msgid)] = "".join(msgstr)

    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            # Comment / blank — terminates current entry.
            if state in ("id", "str"):
                flush()
                msgid = msgstr = None
                state = None
            continue

        if line.startswith("msgid "):
            flush()
            msgid = [unquote(line[len("msgid "):])]
            msgstr = None
            state = "id"
        elif line.startswith("msgstr "):
            msgstr = [unquote(line[len("msgstr "):])]
            state = "str"
        elif line.startswith('"') and state == "id" and msgid is not None:
            msgid.append(unquote(line))
        elif line.startswith('"') and state == "str" and msgstr is not None:
            msgstr.append(unquote(line))

    flush()
    return entries


def unquote(literal: str) -> str:
    """Strip surrounding quotes and decode escapes."""
    literal = literal.strip()
    if literal.startswith('"') and literal.endswith('"'):
        literal = literal[1:-1]
    return (
        literal
        .replace('\\"', '"')
        .replace("\\n", "\n")
        .replace("\\t", "\t")
        .replace("\\\\", "\\")
    )


def compile_mo(entries: dict[str, str], out: Path) -> int:
    """Write entries to a binary .mo file. Returns translated-pair count."""
    # Skip empty translations (untranslated stubs add no value).
    pairs = [(k.encode("utf-8"), v.encode("utf-8")) for k, v in entries.items() if v]
    pairs.sort(key=lambda p: p[0])  # gettext requires sorted order for binary search.
    n = len(pairs)

    # Header (28 bytes) + offset tables (n * 8 each) + 0-terminated strings.
    header_size = 28
    table_size = n * 8
    msgid_offsets_pos = header_size
    msgstr_offsets_pos = msgid_offsets_pos + table_size
    strings_pos = msgstr_offsets_pos + table_size

    msgid_offsets: list[tuple[int, int]] = []
    msgstr_offsets: list[tuple[int, int]] = []
    string_blob = bytearray()

    cursor = strings_pos
    for k, _ in pairs:
        msgid_offsets.append((len(k), cursor))
        string_blob.extend(k + b"\x00")
        cursor += len(k) + 1
    for _, v in pairs:
        msgstr_offsets.append((len(v), cursor))
        string_blob.extend(v + b"\x00")
        cursor += len(v) + 1

    with out.open("wb") as fh:
        # Magic (LE), version 0, n strings, msgid table offset, msgstr table offset,
        # hash size 0, hash offset 0.
        fh.write(struct.pack("<IIIIIII",
            0x950412de, 0, n,
            msgid_offsets_pos, msgstr_offsets_pos, 0, 0))
        for length, offset in msgid_offsets:
            fh.write(struct.pack("<II", length, offset))
        for length, offset in msgstr_offsets:
            fh.write(struct.pack("<II", length, offset))
        fh.write(string_blob)

    return n


def main() -> int:
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <file.po> [<file.po> ...]", file=sys.stderr)
        return 2

    total = 0
    for arg in sys.argv[1:]:
        po = Path(arg)
        if not po.is_file():
            print(f"Not a file: {po}", file=sys.stderr)
            return 1
        mo = po.with_suffix(".mo")
        n = compile_mo(parse_po(po), mo)
        size = mo.stat().st_size
        print(f"  {po.name} -> {mo.name}  ({n} entries, {size} bytes)")
        total += n

    print(f"OK: compiled {total} translated entries.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
