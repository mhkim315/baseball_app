import { getDb } from "./connection";

export interface Collection {
  id: number;
  name: string;
  description: string | null;
  photos: string | null;
  created_at: string;
}

const COLLECTION_ALLOWED_COLUMNS = new Set(["name", "description", "photos"]);

export function addCollection(
  name: string,
  description?: string,
  photos?: string
): number {
  const database = getDb();
  const result = database.runSync(
    "INSERT INTO collections (name, description, photos) VALUES (?, ?, ?)",
    name,
    description ?? null,
    photos ?? null
  );
  return result.lastInsertRowId ?? 0;
}

export function updateCollection(
  id: number,
  fields: { name?: string; description?: string | null; photos?: string | null }
): void {
  const database = getDb();
  const setClauses: string[] = [];
  const values: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (!COLLECTION_ALLOWED_COLUMNS.has(key)) {
      console.warn(`updateCollection: rejected unknown column "${key}"`);
      continue;
    }
    setClauses.push(`${key} = ?`);
    values.push(value ?? null);
  }
  if (setClauses.length === 0) return;
  values.push(id);
  database.runSync(
    `UPDATE collections SET ${setClauses.join(", ")} WHERE id = ?`,
    ...values
  );
}

export function deleteCollection(id: number): void {
  const database = getDb();
  database.runSync("DELETE FROM collections WHERE id = ?", id);
}

export function getAllCollections(): Collection[] {
  const database = getDb();
  return database.getAllSync<Collection>(
    "SELECT * FROM collections ORDER BY created_at DESC"
  );
}

export function parseCollectionPhotos(collection: Collection): string[] {
  if (!collection.photos) return [];
  try {
    const parsed = JSON.parse(collection.photos);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
