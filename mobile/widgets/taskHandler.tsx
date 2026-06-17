import { registerWidgetTaskHandler, type WidgetTaskHandlerProps } from "react-native-android-widget";
import { updateWidgetPeriodic, getLastWidgetGame } from "./updateWidget";
import { NativeModules, AppRegistry } from "react-native";

const { LiveScoreModule } = NativeModules;
async function taskHandler(props: any) {
  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_RESIZED":
    case "WIDGET_UPDATE_PERIODIC":
    case "WIDGET_UPDATE":
      await updateWidgetPeriodic();
      break;
    case "WIDGET_CLICK":
      if (props.clickAction === "TOGGLE_LIVE") {
        if (LiveScoreModule) {
          LiveScoreModule.startService();
        }
      } else if (props.clickAction === "STOP_LIVE") {
        if (LiveScoreModule) {
          LiveScoreModule.stopService();
        }
      } else if (props.clickAction === "REFRESH") {
        await updateWidgetPeriodic();
        const data = getLastWidgetGame();
        if (LiveScoreModule) {
          if (data?.status === "live") {
            LiveScoreModule.startService();
          } else {
            LiveScoreModule.stopService();
          }
        }
        return; // already updated
      }
      await updateWidgetPeriodic();
      break;
  }
}

AppRegistry.registerHeadlessTask("LiveScoreTask", () => async () => {
  try {
    await updateWidgetPeriodic();
  } catch (e) {
    console.warn("LiveScoreTask failed", e);
  }
});

export function registerWidgetTasks() {
  registerWidgetTaskHandler(taskHandler);
}
