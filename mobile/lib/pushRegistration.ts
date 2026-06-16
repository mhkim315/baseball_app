const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "https://api.fullcount.kr";
const APP_VERSION = "1.1.8-test";

export async function registerToken(
  token: string,
  platform: "android" | "ios",
  targetTeamId: string | null,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/push/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        platform,
        target_team_id: targetTeamId || undefined,
        app_version: APP_VERSION,
      }),
    });
    return res.ok;
  } catch (e) {
    console.warn("pushRegistration: registerToken failed", e);
    return false;
  }
}

export async function unregisterToken(
  token: string,
  platform: "android" | "ios",
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/push/unregister`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, platform }),
    });
    return res.ok;
  } catch (e) {
    console.warn("pushRegistration: unregisterToken failed", e);
    return false;
  }
}
