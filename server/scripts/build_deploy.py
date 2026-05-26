"""
배포 폴더(deploy/) 생성 + 이미지 WebP 변환.
사용: python scripts/build_deploy.py
"""
from __future__ import annotations

import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEPLOY = ROOT / "deploy"
WEBP_QUALITY = 85  # 85% 품질 (육안 차이 거의 없음)

# deploy에 포함할 파일
PUBLIC_FILES = [
    "index.html",
    "game-detail.html",
    "schedule.html",
    "cheering.html",
    "stadium-guide.html",
    "rules.html",
    "package.json",
    "sitemap.xml",
    "robots.txt",
]

PUBLIC_DIRS = [
    "css",
    "js",
    "data",
]

# 변환 대상 이미지 디렉토리
IMAGE_DIRS = [
    "picture/food-admin-maps",
    "picture/rules",
    "picture/stadium-seats",
]

# deploy에서 제외할 JS 파일 (개발/관리자 도구)
EXCLUDE_JS = [
    "food-admin-page.js",
    "stadium-map-admin-page.js",
]

# deploy에서 제외할 데이터 파일
EXCLUDE_DATA = [
    "cheering-players.json",
    "cheering-patterns.json",
]


def convert_images():
    """모든 이미지를 WebP로 변환. 같은 크기 유지."""
    total_before = 0
    total_after = 0

    for rel_dir in IMAGE_DIRS:
        src_dir = ROOT / rel_dir
        dst_dir = DEPLOY / rel_dir
        dst_dir.mkdir(parents=True, exist_ok=True)

        for src_path in sorted(src_dir.glob("*")):
            if src_path.suffix.lower() not in (".png", ".jpg", ".jpeg"):
                continue
            name = src_path.stem
            webp_path = dst_dir / f"{name}.webp"

            img = Image.open(src_path)
            if img.mode in ("RGBA", "P"):
                rgb = Image.new("RGB", img.size, (255, 255, 255))
                if img.mode == "P":
                    img = img.convert("RGBA")
                rgb.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
                img = rgb
            elif img.mode != "RGB":
                img = img.convert("RGB")

            img.save(webp_path, "WEBP", quality=WEBP_QUALITY, optimize=True)

            before = src_path.stat().st_size
            after = webp_path.stat().st_size
            total_before += before
            total_after += after
            reduction = (1 - after / before) * 100
            print(f"  {rel_dir}/{name}{src_path.suffix} → .webp  {before//1024}KB → {after//1024}KB ({reduction:.0f}% 감소)")

    print(f"\n  총 {total_before//1024}KB → {total_after//1024}KB ({(1-total_after/total_before)*100:.0f}% 감소)")


def update_image_refs():
    """모든 배포 파일에서 .png → .webp, .jpg → .webp 치환."""
    for ext in ["html", "js", "css", "json"]:
        for f in DEPLOY.rglob(f"*.{ext}"):
            content = f.read_text(encoding="utf-8")
            new_content = content
            new_content = new_content.replace(".png", ".webp")
            new_content = new_content.replace(".jpg", ".webp")
            new_content = new_content.replace(".jpeg", ".webp")
            if new_content != content:
                f.write_text(new_content, encoding="utf-8")
                print(f"  Updated refs in {f.relative_to(DEPLOY)}")


def main():
    if DEPLOY.exists():
        shutil.rmtree(DEPLOY)
    DEPLOY.mkdir()

    print("Converting images to WebP...")
    convert_images()

    print("\nCopying public files...")
    for f in PUBLIC_FILES:
        shutil.copy2(ROOT / f, DEPLOY / f)
        print(f"  {f}")

    for d in PUBLIC_DIRS:
        src = ROOT / d
        dst = DEPLOY / d
        shutil.copytree(src, dst, dirs_exist_ok=True)
        if d == "js":
            for ex in EXCLUDE_JS:
                p = dst / ex
                if p.exists():
                    p.unlink()
        if d == "data":
            for ex in EXCLUDE_DATA:
                p = dst / ex
                if p.exists():
                    p.unlink()
        print(f"  {d}/")

    print("\nUpdating image references → .webp...")
    update_image_refs()

    total_size = sum(f.stat().st_size for f in DEPLOY.rglob("*") if f.is_file())
    print(f"\nDone! deploy/ total size: {total_size // 1024}KB ({total_size / 1024 / 1024:.1f}MB)")


if __name__ == "__main__":
    main()
