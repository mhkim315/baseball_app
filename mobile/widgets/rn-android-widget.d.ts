declare module "react-native-android-widget" {
  import type { ReactElement } from "react";

  export interface WidgetInfo {
    widgetName: string;
    widgetId: number;
    height: number;
    width: number;
    screenInfo: {
      screenHeightDp: number;
      screenWidthDp: number;
      density: number;
      densityDpi: number;
    };
  }

  export interface WidgetTaskHandlerProps {
    widgetAction: "WIDGET_ADDED" | "WIDGET_RESIZED" | "WIDGET_UPDATE" | "WIDGET_UPDATE_PERIODIC";
    widgetInfo?: WidgetInfo;
    renderWidget: (element: ReactElement) => Promise<void>;
  }

  export function registerWidgetTaskHandler(handler: (props: WidgetTaskHandlerProps) => void): void;

  export function requestWidgetUpdate(config: {
    widgetName: string;
    renderWidget: (widgetInfo: WidgetInfo) => ReactElement | null;
    widgetNotFound?: () => void;
  }): Promise<void>;

  export interface FlexWidgetProps {
    style?: Record<string, any>;
    children?: any;
  }

  export interface TextWidgetProps {
    text: string;
    fontSize?: number;
    fontWeight?: string;
    textColor?: string;
  }

  export const FlexWidget: React.FC<FlexWidgetProps>;
  export const TextWidget: React.FC<TextWidgetProps>;
}
