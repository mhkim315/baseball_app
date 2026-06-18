import { registerWidgetTaskHandler } from "react-native-android-widget";
import { updateWidgetPeriodic } from "./updateWidget";

async function handleWidgetAction(props: any) {
  const { widgetAction, clickAction } = props;
  switch (widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_RESIZED":
    case "WIDGET_UPDATE":
    case "WIDGET_UPDATE_PERIODIC":
      await updateWidgetPeriodic();
      break;
    case "WIDGET_CLICK":
      if (clickAction === "REFRESH" || clickAction === "OPEN_APP") {
        await updateWidgetPeriodic();
      }
      break;
  }
}

export function registerWidgetTasks() {
  registerWidgetTaskHandler(handleWidgetAction);
}
