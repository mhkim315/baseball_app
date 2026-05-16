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
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  return `jikgwan_${ts}.jpg`;
}

export async function savePhoto(sourceUri: string, fileName: string): Promise<string> {
  const dir = await ensurePhotoDir();
  const dest = new File(dir, fileName);
  const src = new File(sourceUri);
  src.move(dest);
  return dest.uri;
}

export async function resizePhoto(uri: string, maxWidth = 1200): Promise<string> {
  const result = await manipulateAsync(uri, [{ resize: { width: maxWidth } }], {
    format: SaveFormat.JPEG,
    compress: 0.85,
  });
  return result.uri;
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
  const file = new File(uri);
  if (file.exists) {
    file.delete();
  }
}
