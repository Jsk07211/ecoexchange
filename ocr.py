"""
OCR via Gemini. Supports images and PDFs, single or batch.

Usage:
    python ocr.py file1.png file2.pdf folder/
    python ocr.py image.png --format json
    python ocr.py docs/ --out results/
"""

import os
import sys
import json
import argparse
import base64
from pathlib import Path
from typing import Literal
from concurrent.futures import ThreadPoolExecutor, as_completed

import PIL.Image
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
MODEL = "gemini-2.0-flash"

SUPPORTED = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tiff", ".pdf"}

PROMPTS = {
    "text": "Transcribe all text in this file exactly as it appears. Preserve layout where possible.",
    "json": (
        "Extract all text from this file. Respond with JSON only, no markdown:\n"
        '{"pages": [{"page": 1, "text": "...", "language": "en", "has_tables": false}]}'
    ),
    "markdown": (
        "Transcribe all text from this file into clean Markdown. "
        "Use headers, lists, tables, and code blocks where appropriate."
    ),
}


def _load_contents(path: Path) -> list:
    """Return Gemini-compatible content parts for a file."""
    if path.suffix.lower() == ".pdf":
        data = base64.standard_b64encode(path.read_bytes()).decode()
        return [types.Part.from_bytes(data=base64.b64decode(data), mime_type="application/pdf")]
    return [PIL.Image.open(path)]


def ocr_file(path: Path, fmt: Literal["text", "json", "markdown"] = "text") -> dict:
    contents = _load_contents(path) + [PROMPTS[fmt]]
    response = client.models.generate_content(model=MODEL, contents=contents)
    raw = response.text.strip()

    result = {"file": str(path), "format": fmt, "tokens": response.usage_metadata.prompt_token_count}

    if fmt == "json":
        try:
            # strip accidental markdown fences
            cleaned = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            result["data"] = json.loads(cleaned)
        except json.JSONDecodeError:
            result["data"] = raw  # fall back to raw if model didn't comply
    else:
        result["data"] = raw

    return result


def collect_paths(inputs: list[str]) -> list[Path]:
    paths = []
    for inp in inputs:
        p = Path(inp)
        if p.is_dir():
            paths.extend(f for f in p.rglob("*") if f.suffix.lower() in SUPPORTED)
        elif p.suffix.lower() in SUPPORTED:
            paths.append(p)
        else:
            print(f"Skipping unsupported file: {p}", file=sys.stderr)
    return paths


def write_output(result: dict, out_dir: Path | None, fmt: str) -> None:
    ext = {"text": ".txt", "json": ".json", "markdown": ".md"}[fmt]
    content = json.dumps(result["data"], indent=2) if fmt == "json" else result["data"]

    if out_dir:
        out_dir.mkdir(parents=True, exist_ok=True)
        dest = out_dir / (Path(result["file"]).stem + ext)
        dest.write_text(content, encoding="utf-8")
        print(f"Wrote {dest}  ({result['tokens']} tokens)")
    else:
        print(f"\n--- {result['file']} ({result['tokens']} tokens) ---\n{content}")


def main() -> None:
    parser = argparse.ArgumentParser(description="OCR images and PDFs via Gemini")
    parser.add_argument("inputs", nargs="+", help="Image/PDF files or directories")
    parser.add_argument("--format", choices=["text", "json", "markdown"], default="text")
    parser.add_argument("--out", help="Output directory (omit to print to stdout)")
    parser.add_argument("--workers", type=int, default=4, help="Parallel workers for batch")
    args = parser.parse_args()

    paths = collect_paths(args.inputs)
    if not paths:
        sys.exit("No supported files found.")

    out_dir = Path(args.out) if args.out else None

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(ocr_file, p, args.format): p for p in paths}
        for future in as_completed(futures):
            p = futures[future]
            try:
                result = future.result()
                write_output(result, out_dir, args.format)
            except Exception as e:
                print(f"Error processing {p}: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
