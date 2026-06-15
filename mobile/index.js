// 1. 백그라운드 핸들러 선등록 (앱이 꺼져있을 때 즉각 반응)
import { setupBackgroundHandlerDefault } from "./lib/fcm";
import { registerWidgetTasks } from "./widgets/taskHandler";
import { updateWidgetFromFCM } from "./widgets/updateWidget";
import { updateLockScreenScore } from "./lib/notification";

setupBackgroundHandlerDefault(async (data) => {
  if (data.type === "game_update") {
    // 위젯 강제 업데이트
    await updateWidgetFromFCM(data);
    // 잠금화면 실시간 점수판 알림 업데이트
    await updateLockScreenScore(data);
  }
});

registerWidgetTasks();

// 2. Expo Router 엔트리
import "expo-router/entry";
