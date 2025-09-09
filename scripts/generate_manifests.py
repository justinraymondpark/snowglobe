#!/usr/bin/env python3
from pathlib import Path
import json

def build_manifest(dir_path: Path, exts: set[str]) -> list[str]:
    files: list[str] = []
    for p in sorted(dir_path.iterdir()):
        if not p.is_file():
            continue
        if p.name.startswith('.'):
            continue
        if p.name == '_manifest.json':
            continue
        if p.suffix.lower() in exts:
            # URLs to use in the client
            rel_url = f"/public/{dir_path.name}/{p.name}"
            files.append(rel_url)
    return files

def write_manifest(dir_path: Path, files: list[str]):
    out_path = dir_path / '_manifest.json'
    out_path.write_text(json.dumps({"files": files}, indent=2))
    print(f"Wrote {out_path} ({len(files)} entries)")

def main():
    repo_root = Path(__file__).resolve().parents[1]
    png_dir = repo_root / 'public' / 'png'
    video_dir = repo_root / 'public' / 'video'
    png_dir.mkdir(parents=True, exist_ok=True)
    video_dir.mkdir(parents=True, exist_ok=True)

    pngs = build_manifest(png_dir, {'.png'})
    videos = build_manifest(video_dir, {'.mp4', '.mov', '.webm', '.m4v', '.ogg', '.ogv', '.avi', '.mkv'})

    write_manifest(png_dir, pngs)
    write_manifest(video_dir, videos)

if __name__ == '__main__':
    main()


