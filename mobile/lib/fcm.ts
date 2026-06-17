import messaging from "@react-native-firebase/messaging";
import { Platform, PermissionsAndroid } from "react-native";

type ForegroundHandler = (data: Record<string, string>) => void;
type BackgroundHandler = (data: Record<string, string>) => Promise<void>;

let _onForeground: ForegroundHandler | null = null;

export async function requestUserPermission(): Promise<boolean> {
  if (Platform.OS === "android" && Platform.Version >= 33) {
    try {
      const status = await PermissionsAndroid.request(
        "android.permission.POST_NOTIFICATIONS" as any,
      );
      return status === "granted";
    } catch (e) {
      console.warn("fcm: POST_NOTIFICATIONS request failed", e);
      return false;
    }
  }
  if (Platform.OS === "ios") {
    const authStatus = await messaging().requestPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  }
  return true;
}

export async function getFCMToken(): Promise<string | null> {
  try {
    await messaging().registerDeviceForRemoteMessages();
    return await messaging().getToken();
  } catch (e) {
    console.warn("fcm: getFCMToken failed", e);
    return null;
  }
}

export function onTokenRefresh(listener: (token: string) => void): () => void {
  return messaging().onTokenRefresh(listener);
}

export function onForegroundMessage(handler: ForegroundHandler): () => void {
  _onForeground = handler;
  const unsub = messaging().onMessage(async (msg) => {
    if (_onForeground && msg.data) {
      _onForeground(msg.data as Record<string, string>);
    }
  });
  return unsub;
}

export function setupBackgroundHandler(handler: BackgroundHandler): void {
  messaging().setBackgroundMessageHandler(async (msg) => {
    if (msg.data) {
      await handler(msg.data as Record<string, string>);
    }
  });
}

export function setupBackgroundHandlerDefault(handler: BackgroundHandler): void {
  setupBackgroundHandler(handler);
}
