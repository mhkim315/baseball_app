import { getDb } from "./connection";

export interface Collection {
  id: number;
  name: string;
  description: string | null;
  photos: string | null;
  created_at: string;
}

const COLLECTION_ALLOWED_COLUMNS = new Set(["name", "description", "photos"]);

export async function addCollection(
  name: string,
  description?: string,
  photos?: string
): Promise<number> {
  const database = await getDb();
  const result = await database.runAsync(
    "INSERT INTO collections (name, description, photos) VALUES (?, ?, ?)",
    name,
    description ?? null,
    photos ?? null
  );
  return result.lastInsertRowId ?? 0;
}

export async function updateCollection(
  id: number,
  fields: { name?: string; description?: string | null; photos?: string | null }
): Promise<void> {
  const database = await getDb();
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
  await database.runAsync(
    `UPDATE collections SET ${setClauses.join(", ")} WHERE id = ?`,
    ...values
  );
}

export async function deleteCollection(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM collections WHERE id = ?", id);
}

export async function getAllCollections(): Promise<Collection[]> {
  const database = await getDb();
  return database.getAllAsync<Collection>(
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
