// Social Login Configuration
// 각 제공자 개발자 콘솔에서 발급받은 키로 설정하세요.

export const SOCIAL_CONFIG = {
  kakao: {
    restApiKey: process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY || "",
  },
  naver: {
    clientId: process.env.EXPO_PUBLIC_NAVER_CLIENT_ID || "",
    clientSecret: process.env.EXPO_PUBLIC_NAVER_CLIENT_SECRET || "",
  },
  google: {
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "",
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "",
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "",
  },
  apple: {
    // Apple Sign In uses the bundle identifier, no config needed here
  },
};

// Redirect URI for OAuth (handled by expo-auth-session)
export function getRedirectUri(): string {
  return process.env.EXPO_PUBLIC_REDIRECT_URI || "kr.fullcount.app://auth";
}
