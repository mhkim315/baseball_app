import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useTeam } from "@/lib/TeamContext";
import {
  requestUserPermission,
  getFCMToken,
  onTokenRefresh,
  onForegroundMessage,
} from "./fcm";
import { registerToken, unregisterToken } from "./pushRegistration";
import { updateWidgetFromFCM } from "@/widgets/updateWidget";
import { setupNotificationChannel } from "@/lib/notification";

export function usePushSetup() {
  const { myTeam } = useTeam();
  const currentTokenRef = useRef<string | null>(null);
  const registeredTeamRef = useRef<string | null>(null);

  useEffect(() => {
    let unsubForeground: (() => void) | undefined;
    let unsubToken: (() => void) | undefined;
    let mounted = true;

    async function setup() {
      // 1. 알림 채널 생성 (무음 점수판 채널)
      await setupNotificationChannel();

      const granted = await requestUserPermission();
      if (!granted) return;

      const token = await getFCMToken();
      if (!token || !mounted) return;
      currentTokenRef.current = token;

      const platform = Platform.OS as "android" | "ios";
      const team = myTeam;
      await registerToken(token, platform, team);
      if (team) registeredTeamRef.current = team;

      // Foreground message → widget update only (lock screen notification deferred)
      unsubForeground = onForegroundMessage(async (data) => {
        if (data.type === "game_update") {
          await updateWidgetFromFCM(data);
        }
      });

      // Token refresh → re-register
      unsubToken = onTokenRefresh(async (newToken) => {
        currentTokenRef.current = newToken;
        await registerToken(newToken, platform, myTeam);
      });
    }

    setup();

    return () => {
      mounted = false;
      unsubForeground?.();
      unsubToken?.();
    };
  }, []);

  // Re-register when myTeam changes
  useEffect(() => {
    const token = currentTokenRef.current;
    if (!token) return;
    if (myTeam === registeredTeamRef.current) return;

    const platform = Platform.OS as "android" | "ios";
    registerToken(token, platform, myTeam);
    registeredTeamRef.current = myTeam;
  }, [myTeam]);
}
