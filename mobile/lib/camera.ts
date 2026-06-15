import * as FileSystem from "expo-file-system/legacy";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { getDb } from "./db/connection";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PHOTO_DIR_NAME = "jikgwan";

/** 저장된 사진 URI를 현재 documentDirectory 기준으로 재구성 */
export function resolvePhotoUri(storedUri: string): string {
  if (storedUri.startsWith("content://") || storedUri.startsWith("ph://")) {
    return storedUri;
  }
  const filename = storedUri.split("/").pop() || storedUri;
  if (!filename) return storedUri;
  const dirUri = `${FileSystem.documentDirectory}${PHOTO_DIR_NAME}/`;
  return `${dirUri}${filename}`;
}

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
  } catch (e) {
    throw new Error(`사진 리사이즈 실패: ${e instanceof Error ? e.message : String(e)}`);
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

export async function repairAllPhotoPaths(): Promise<void> {
  try {
    const isRepaired = await AsyncStorage.getItem("jikgwan_photo_paths_repaired_v1");
    if (isRepaired === "true") {
      return;
    }

    const db = getDb();
    const rows = db.getAllSync<{ id: number; photo_path: string | null; photos: string | null }>(
      "SELECT id, photo_path, photos FROM jikgwan_records WHERE photo_path LIKE 'file://%' OR photos LIKE '%file://%'"
    );

    if (rows.length === 0) {
      await AsyncStorage.setItem("jikgwan_photo_paths_repaired_v1", "true");
      return;
    }

    let updated = 0;
    for (const row of rows) {
      let changed = false;
      let newPhotoPath = row.photo_path;
      
      if (newPhotoPath && newPhotoPath.startsWith("file://")) {
        newPhotoPath = resolvePhotoUri(newPhotoPath);
        changed = true;
      }

      let newPhotos = row.photos;
      if (newPhotos && newPhotos.includes("file://")) {
        try {
          const parsed = JSON.parse(newPhotos) as string[];
          const repaired = parsed.map(p => p.startsWith("file://") ? resolvePhotoUri(p) : p);
          newPhotos = JSON.stringify(repaired);
          changed = true;
        } catch {
          // ignore parse error
        }
      }

      if (changed) {
        db.runSync(
          "UPDATE jikgwan_records SET photo_path = ?, photos = ? WHERE id = ?",
          [newPhotoPath, newPhotos, row.id]
        );
        updated++;
      }
    }

    console.log(`[DB] Repaired ${updated} old photo paths.`);
    
    // We don't import invalidateRecordsCache here to avoid circular dependency
    // Just relying on the next load since this runs on app boot
    
    await AsyncStorage.setItem("jikgwan_photo_paths_repaired_v1", "true");
  } catch (e) {
    console.warn("repairAllPhotoPaths error:", e);
  }
}
