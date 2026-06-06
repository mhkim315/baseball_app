import { DEFAULT_BACKGROUNDS } from "@/lib/backgrounds";
import { getDb } from "./connection";
import { formatDate } from "../dateUtils";

export function getSetting(key: string): string | null {
  const database = getDb();
  const row = database.getFirstSync<{ value: string }>(
    "SELECT value FROM user_settings WHERE key = ?",
    key
  );
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const database = getDb();
  database.runSync(
    "INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)",
    key,
    value
  );
}

export function getMyTeam(): string | null {
  return getSetting("my_team");
}

export function setMyTeam(teamId: string): void {
  setSetting("my_team", teamId);
}

export function getNickname(): string | null {
  return getSetting("nickname");
}

export function setNickname(name: string): void {
  setSetting("nickname", name);
}

export function getInstallDate(): string {
  const existing = getSetting("install_date");
  if (existing) return existing;
  const now = new Date();
  const dateStr = formatDate(now);
  setSetting("install_date", dateStr);
  return dateStr;
}

export function getProfileImage(): { type: string; value: string } | null {
  const raw = getSetting("profile_image");
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  const type = getSetting("profile_image_type");
  const value = getSetting("profile_image_value");
  if (type && value) return { type, value };
  return null;
}

export function setProfileImage(type: string, value: string): void {
  setSetting("profile_image", JSON.stringify({ type, value }));
}

export function getUnlockedEmotions(): string[] {
  const raw = getSetting("unlocked_emotions");
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  const basic = ["default", "sad", "joyful"];
  setSetting("unlocked_emotions", JSON.stringify(basic));
  return basic;
}

export function addUnlockedEmotion(emotion: string): void {
  const database = getDb();
  database.runSync("BEGIN IMMEDIATE");
  try {
    const row = database.getFirstSync<{ value: string }>(
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
      database.runSync(
        "INSERT OR REPLACE INTO user_settings (key, value) VALUES ('unlocked_emotions', ?)",
        JSON.stringify(current)
      );
    }
    database.runSync("COMMIT");
  } catch (e) {
    database.runSync("ROLLBACK");
    throw e;
  }
}

export function getUnlockedBackgrounds(): string[] {
  const raw = getSetting("unlocked_backgrounds");
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  const basic = [...DEFAULT_BACKGROUNDS];
  setSetting("unlocked_backgrounds", JSON.stringify(basic));
  return basic;
}

export function addUnlockedBackgrounds(bgKeys: string[]): void {
  if (bgKeys.length === 0) return;
  const database = getDb();
  database.runSync("BEGIN IMMEDIATE");
  try {
    const row = database.getFirstSync<{ value: string }>(
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
      database.runSync(
        "INSERT OR REPLACE INTO user_settings (key, value) VALUES ('unlocked_backgrounds', ?)",
        JSON.stringify(current)
      );
    }
    database.runSync("COMMIT");
  } catch (e) {
    database.runSync("ROLLBACK");
    throw e;
  }
}

// === Coach Marks ===

export function getHomeCoachSeen(): boolean {
  return getSetting("has_seen_home_coach") === "true";
}
export function setHomeCoachSeen(): void {
  setSetting("has_seen_home_coach", "true");
}

export function getTodayBackCoachSeen(): boolean {
  return getSetting("has_seen_today_back_coach") === "true";
}
export function setTodayBackCoachSeen(): void {
  setSetting("has_seen_today_back_coach", "true");
}

export function getHomeStickerCoachSeen(): boolean {
  return getSetting("has_seen_home_sticker_coach") === "true";
}
export function setHomeStickerCoachSeen(): void {
  setSetting("has_seen_home_sticker_coach", "true");
}

export function getGameStickerCoachSeen(): boolean {
  return getSetting("has_seen_game_sticker_coach") === "true";
}
export function setGameStickerCoachSeen(): void {
  setSetting("has_seen_game_sticker_coach", "true");
}

export function getCheerTeamCoachSeen(): boolean {
  return getSetting("has_seen_cheer_team_coach") === "true";
}
export function setCheerTeamCoachSeen(): void {
  setSetting("has_seen_cheer_team_coach", "true");
}

export function getRankYearCoachSeen(): boolean {
  return getSetting("has_seen_rank_year_coach") === "true";
}
export function setRankYearCoachSeen(): void {
  setSetting("has_seen_rank_year_coach", "true");
}

export function getDiaryCoachSeen(): boolean {
  return getSetting("has_seen_diary_coach") === "true";
}
export function setDiaryCoachSeen(): void {
  setSetting("has_seen_diary_coach", "true");
}

export function getStadiumCoachSeen(): boolean {
  return getSetting("has_seen_stadium_coach") === "true";
}
export function setStadiumCoachSeen(): void {
  setSetting("has_seen_stadium_coach", "true");
}

export function getMyCoachSeen(): boolean {
  return getSetting("has_seen_my_coach") === "true";
}
export function setMyCoachSeen(): void {
  setSetting("has_seen_my_coach", "true");
}

// === Visit Count ===
export function getVisitCount(): number {
  const val = getSetting("visit_count");
  return val ? parseInt(val, 10) : 0;
}

export function incrementVisitCount(): number {
  const current = getVisitCount();
  const next = current + 1;
  setSetting("visit_count", String(next));
  return next;
}

// === Shortcut ===
export function getShortcut(): string | null {
  return getSetting("shortcut");
}
export function setShortcut(type: string): void {
  setSetting("shortcut", type);
}
