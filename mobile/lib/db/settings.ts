import { DEFAULT_BACKGROUNDS } from "@/lib/backgrounds";
import { getDb } from "./connection";

export async function getSetting(key: string): Promise<string | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM user_settings WHERE key = ?",
    key
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    "INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)",
    key,
    value
  );
}

export async function getMyTeam(): Promise<string | null> {
  return getSetting("my_team");
}

export async function setMyTeam(teamId: string): Promise<void> {
  await setSetting("my_team", teamId);
}

export async function getNickname(): Promise<string | null> {
  return getSetting("nickname");
}

export async function setNickname(name: string): Promise<void> {
  await setSetting("nickname", name);
}

export async function getInstallDate(): Promise<string> {
  const existing = await getSetting("install_date");
  if (existing) return existing;
  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
  await setSetting("install_date", dateStr);
  return dateStr;
}

export async function getProfileImage(): Promise<{ type: string; value: string } | null> {
  const raw = await getSetting("profile_image");
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  const type = await getSetting("profile_image_type");
  const value = await getSetting("profile_image_value");
  if (type && value) return { type, value };
  return null;
}

export async function setProfileImage(type: string, value: string): Promise<void> {
  await setSetting("profile_image", JSON.stringify({ type, value }));
}

export async function getUnlockedEmotions(): Promise<string[]> {
  const raw = await getSetting("unlocked_emotions");
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  const basic = ["default", "sad", "joyful"];
  await setSetting("unlocked_emotions", JSON.stringify(basic));
  return basic;
}

export async function addUnlockedEmotion(emotion: string): Promise<void> {
  const database = await getDb();
  await database.runAsync("BEGIN IMMEDIATE");
  try {
    const row = await database.getFirstAsync<{ value: string }>(
      "SELECT value FROM user_settings WHERE key = 'unlocked_emotions'"
    );
    let current: string[];
    if (row?.value) {
      try { current = JSON.parse(row.value); } catch { current = []; }
    } else {
      current = ["default", "sad", "joyful"];
    }
    if (!current.includes(emotion)) {
      current.push(emotion);
      await database.runAsync(
        "INSERT OR REPLACE INTO user_settings (key, value) VALUES ('unlocked_emotions', ?)",
        JSON.stringify(current)
      );
    }
    await database.runAsync("COMMIT");
  } catch (e) {
    await database.runAsync("ROLLBACK");
    throw e;
  }
}

export async function getUnlockedBackgrounds(): Promise<string[]> {
  const raw = await getSetting("unlocked_backgrounds");
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  const basic = [...DEFAULT_BACKGROUNDS];
  await setSetting("unlocked_backgrounds", JSON.stringify(basic));
  return basic;
}

export async function addUnlockedBackgrounds(bgKeys: string[]): Promise<void> {
  if (bgKeys.length === 0) return;
  const database = await getDb();
  await database.runAsync("BEGIN IMMEDIATE");
  try {
    const row = await database.getFirstAsync<{ value: string }>(
      "SELECT value FROM user_settings WHERE key = 'unlocked_backgrounds'"
    );
    let current: string[];
    if (row?.value) {
      try { current = JSON.parse(row.value); } catch { current = []; }
    } else {
      current = [...DEFAULT_BACKGROUNDS];
    }
    let changed = false;
    for (const key of bgKeys) {
      if (!current.includes(key)) {
        current.push(key);
        changed = true;
      }
    }
    if (changed) {
      await database.runAsync(
        "INSERT OR REPLACE INTO user_settings (key, value) VALUES ('unlocked_backgrounds', ?)",
        JSON.stringify(current)
      );
    }
    await database.runAsync("COMMIT");
  } catch (e) {
    await database.runAsync("ROLLBACK");
    throw e;
  }
}

export async function getHomeCoachSeen(): Promise<boolean> {
  return (await getSetting("has_seen_home_coach")) === "true";
}

export async function setHomeCoachSeen(): Promise<void> {
  await setSetting("has_seen_home_coach", "true");
}

export async function getTodayBackCoachSeen(): Promise<boolean> {
  return (await getSetting("has_seen_today_back_coach")) === "true";
}

export async function setTodayBackCoachSeen(): Promise<void> {
  await setSetting("has_seen_today_back_coach", "true");
}

export async function getGameStickerCoachSeen(): Promise<boolean> {
  return (await getSetting("has_seen_game_sticker_coach")) === "true";
}

export async function setGameStickerCoachSeen(): Promise<void> {
  await setSetting("has_seen_game_sticker_coach", "true");
}

export async function getDiaryCoachSeen(): Promise<boolean> {
  return (await getSetting("has_seen_diary_coach")) === "true";
}

export async function setDiaryCoachSeen(): Promise<void> {
  await setSetting("has_seen_diary_coach", "true");
}
