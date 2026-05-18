import { Paths, File, Directory } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

function getPhotoDir(): Directory {
  return new Directory(Paths.document, "jikgwan");
}

export async function ensurePhotoDir(): Promise<Directory> {
  const dir = getPhotoDir();
  if (!dir.exists) {
    dir.create();
  }
  return dir;
}

export function generatePhotoName(): string {
  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}${String(now.getMilliseconds()).padStart(3, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6);
  return `jikgwan_${ts}_${rand}.jpg`;
}

export async function savePhoto(sourceUri: string, fileName: string): Promise<string> {
  const dir = await ensurePhotoDir();
  const dest = new File(dir, fileName);

  // Try 1: move (fastest, works with file:// URIs)
  const src = new File(sourceUri);
  if (src.exists) {
    try {
      src.move(dest);
      return dest.uri;
    } catch {
      try {
        src.copy(dest);
        if (src.exists) src.delete();
        return dest.uri;
      } catch {}
    }
  }

  // Try 2: fetch + write (handles content:// and any URI fetch supports)
  try {
    const response = await fetch(sourceUri);
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    dest.write(new Uint8Array(buffer));
    return dest.uri;
  } catch (e) {
    throw new Error("사진 저장 실패");
  }
}

export async function resizePhoto(uri: string, maxWidth = 1200): Promise<string> {
  try {
    const result = await manipulateAsync(uri, [{ resize: { width: maxWidth } }], {
      format: SaveFormat.JPEG,
      compress: 0.85,
    });
    return result.uri;
  } catch {
    console.warn("resizePhoto failed, returning original");
    return uri;
  }
}

export async function getSavedPhotos(): Promise<string[]> {
  const dir = await ensurePhotoDir();
  const files = dir.list();
  return files
    .filter((f): f is File => f instanceof File && f.extension === ".jpg")
    .sort((a, b) => b.name.localeCompare(a.name))
    .map((f) => f.uri);
}

export async function deletePhoto(uri: string): Promise<void> {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // non-critical
  }
}
