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
        await updateWidgetPeriodic(true);                          // fetch + BSO visible
        await new Promise<void>(r => setTimeout(r, 15_000));
        await updateWidgetPeriodic(false);                        // re-render cached → BSO hidden
        return;
      }
      await updateWidgetPeriodic();
      break;
  }
}

export function registerWidgetTasks() {
  registerWidgetTaskHandler(taskHandler);
}
