import os
import sys
from PIL import Image
import shutil

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "..", "assets")
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "client", "public")

CHAR_DIR = os.path.join(ASSETS_DIR, "team-characters")
BALL_DIR = os.path.join(ASSETS_DIR, "team-ball")
BAT_DIR = os.path.join(ASSETS_DIR, "team-bat")

for d in [CHAR_DIR, BALL_DIR, BAT_DIR]:
    os.makedirs(d, exist_ok=True)

def convert_dir(src_dir, dest_dir):
    if not os.path.exists(src_dir):
        print(f"Source dir {src_dir} not found.")
        return
    for f in os.listdir(src_dir):
        if f.endswith(".png"):
            src_path = os.path.join(src_dir, f)
            dest_path = os.path.join(dest_dir, f.replace(".png", ".webp"))
            if not os.path.exists(dest_path):
                try:
                    img = Image.open(src_path)
                    img.save(dest_path, "WEBP", quality=85)
                    print(f"Converted {src_path} -> {dest_path}")
                except Exception as e:
                    print(f"Error converting {src_path}: {e}")

convert_dir(os.path.join(PUBLIC_DIR, "team-characters"), CHAR_DIR)
convert_dir(os.path.join(PUBLIC_DIR, "team-ball"), BALL_DIR)
convert_dir(os.path.join(PUBLIC_DIR, "team-bat"), BAT_DIR)

# Remove any remaining .png in mobile/assets/team-characters
for root, _, files in os.walk(CHAR_DIR):
    for f in files:
        if f.endswith(".png"):
            os.remove(os.path.join(root, f))
            print(f"Removed old png {f}")

print("Local conversion complete.")
