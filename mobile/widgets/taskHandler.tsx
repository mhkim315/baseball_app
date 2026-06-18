import { registerWidgetTaskHandler } from "react-native-android-widget";
import { updateWidgetPeriodic } from "./updateWidget";

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
        // 20s mini-polling: 5s interval x 4 updates, then hide BSO before context dies
        for (let i = 0; i < 4; i++) {
          await updateWidgetPeriodic(true);
          if (i < 3) await new Promise<void>(r => setTimeout(r, 5_000));
        }
        await new Promise<void>(r => setTimeout(r, 5_000));
        await updateWidgetPeriodic(false);
        return;
      }
      await updateWidgetPeriodic();
      break;
  }
}

export function registerWidgetTasks() {
  registerWidgetTaskHandler(taskHandler);
}
