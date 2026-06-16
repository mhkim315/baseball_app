import { registerWidgetTaskHandler, type WidgetTaskHandlerProps } from "react-native-android-widget";
import { updateWidgetPeriodic } from "./updateWidget";

async function taskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_RESIZED":
    case "WIDGET_UPDATE_PERIODIC":
    case "WIDGET_UPDATE":
      await updateWidgetPeriodic();
      break;
  }
}

export function registerWidgetTasks() {
  registerWidgetTaskHandler(taskHandler);
}
