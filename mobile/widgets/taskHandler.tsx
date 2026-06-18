import { registerWidgetTaskHandler } from "react-native-android-widget";
import { updateWidgetPeriodic } from "./updateWidget";

let _lastRefresh = 0;
const COOLDOWN_MS = 5_000;

async function taskHandler(props: any) {
  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_RESIZED":
    case "WIDGET_UPDATE_PERIODIC":
    case "WIDGET_UPDATE":
      await updateWidgetPeriodic();
      break;
    case "WIDGET_CLICK":
      if (props.clickAction === "REFRESH") {
        const now = Date.now();
        if (now - _lastRefresh < COOLDOWN_MS) return;
        _lastRefresh = now;
        for (let i = 0; i < 5; i++) {
          await updateWidgetPeriodic();
          if (i < 4) await new Promise<void>(r => setTimeout(r, 5_000));
        }
        return;
      }
      await updateWidgetPeriodic();
      break;
  }
}

export function registerWidgetTasks() {
  registerWidgetTaskHandler(taskHandler);
}
