// 1. 백그라운드 핸들러 선등록 (앱이 꺼져있을 때 즉각 반응)
// Firebase not available on iOS simulator — wrap gracefully
let fcmReady = false;
try {
  const { setupBackgroundHandlerDefault } = require("./lib/fcm");
  const { registerWidgetTasks } = require("./widgets/taskHandler");
  const { updateWidgetFromFCM } = require("./widgets/updateWidget");
  const { updateLockScreenScore } = require("./lib/notification");

  setupBackgroundHandlerDefault(async (data) => {
    if (data.type === "game_update") {
      await updateWidgetFromFCM(data);
      await updateLockScreenScore(data);
    }
  });

  registerWidgetTasks();
  fcmReady = true;
} catch (e) {
  console.warn("[FCM] Firebase not available (expected on iOS simulator):", e.message);
}

if (!fcmReady) {
  try {
    require("./widgets/taskHandler").registerWidgetTasks();
  } catch (e) {
    console.warn("[Widget] task registration failed:", e.message);
  }
}

// 2. Expo Router 엔트리
import "expo-router/entry";
