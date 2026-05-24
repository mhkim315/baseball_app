import * as FileSystem from "expo-file-system/legacy";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

const PHOTO_DIR_NAME = "jikgwan";

export async function ensurePhotoDir(): Promise<string> {
  const dirUri = `${FileSystem.documentDirectory}${PHOTO_DIR_NAME}/`;
  const info = await FileSystem.getInfoAsync(dirUri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
  }
  return dirUri;
}

export function generatePhotoName(): string {
  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}${String(now.getMilliseconds()).padStart(3, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6);
  return `jikgwan_${ts}_${rand}.jpg`;
}

export async function savePhoto(sourceUri: string, fileName: string): Promise<string> {
  const dirUri = await ensurePhotoDir();
  const destUri = `${dirUri}${fileName}`;
  try {
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });
    return destUri;
  } catch (e) {
    console.warn("savePhoto failed", e);
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
  const dirUri = await ensurePhotoDir();
  const files = await FileSystem.readDirectoryAsync(dirUri);
  return files
    .filter((f) => f.endsWith(".jpg"))
    .sort((a, b) => b.localeCompare(a))
    .map((f) => `${dirUri}${f}`);
}

export async function cropToSquare(uri: string, cropRect: { originX: number; originY: number; width: number; height: number }): Promise<string> {
  try {
    const result = await manipulateAsync(uri, [{ crop: cropRect }], {
      format: SaveFormat.JPEG,
      compress: 0.85,
    });
    return result.uri;
  } catch {
    console.warn("cropToSquare failed, returning original");
    return uri;
  }
}

export async function deletePhoto(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // non-critical
  }
}

export async function deleteAllPhotos(): Promise<void> {
  try {
    const dirUri = `${FileSystem.documentDirectory}${PHOTO_DIR_NAME}/`;
    const info = await FileSystem.getInfoAsync(dirUri);
    if (info.exists) {
      await FileSystem.deleteAsync(dirUri, { idempotent: false });
    }
  } catch (e) {
    console.warn("deleteAllPhotos failed", e);
  }
}
