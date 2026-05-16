import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import { makeRedirectUri, useAuthRequest } from "expo-auth-session";
import { useAuth } from "@/lib/AuthContext";
import { theme } from "@/lib/theme";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import { SOCIAL_CONFIG, getRedirectUri } from "@/lib/socialConfig";

// Required for expo-auth-session
WebBrowser.maybeCompleteAuthSession();

// Kakao OAuth discovery
const kakaoDiscovery = {
  authorizationEndpoint: "https://kauth.kakao.com/oauth/authorize",
  tokenEndpoint: "https://kauth.kakao.com/oauth/token",
};

// Naver OAuth discovery
const naverDiscovery = {
  authorizationEndpoint: "https://nid.naver.com/oauth2.0/authorize",
  tokenEndpoint: "https://nid.naver.com/oauth2.0/token",
};

type Provider = "kakao" | "naver" | "google" | "apple";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [loading, setLoading] = useState<Provider | null>(null);

  // Kakao Auth Request
  const [kakaoRequest, , kakaoPrompt] = useAuthRequest(
    {
      clientId: SOCIAL_CONFIG.kakao.restApiKey,
      redirectUri: makeRedirectUri({ native: getRedirectUri(), path: "auth" }),
      scopes: ["profile_nickname", "profile_image", "account_email"],
      extraParams: {
        response_type: "code",
      },
    },
    kakaoDiscovery
  );

  // Naver Auth Request
  const [naverRequest, , naverPrompt] = useAuthRequest(
    {
      clientId: SOCIAL_CONFIG.naver.clientId,
      clientSecret: SOCIAL_CONFIG.naver.clientSecret,
      redirectUri: makeRedirectUri({ native: getRedirectUri(), path: "auth" }),
      scopes: ["nickname", "profile_image"],
      extraParams: {
        response_type: "code",
      },
    },
    naverDiscovery
  );

  const handleLogin = async (provider: Provider) => {
    setLoading(provider);

    try {
      if (provider === "apple") {
        await handleAppleLogin();
      } else if (provider === "kakao") {
        await handleOAuthLogin("kakao", kakaoRequest, kakaoPrompt, "https://kapi.kakao.com/v2/user/me");
      } else if (provider === "naver") {
        await handleOAuthLogin("naver", naverRequest, naverPrompt, "https://openapi.naver.com/v1/nid/me");
      } else if (provider === "google") {
        await handleGoogleLogin();
      }
    } catch (err: any) {
      Alert.alert("로그인 실패", err?.message || "다시 시도해주세요");
    } finally {
      setLoading(null);
    }
  };

  const handleOAuthLogin = async (
    provider: "kakao" | "naver",
    request: any,
    prompt: any,
    _userInfoUrl: string,
  ) => {
    if (!request) {
      Alert.alert("설정 필요", `${provider} 로그인 설정이 필요합니다`);
      return;
    }

    const result = await prompt();
    if (result?.type !== "success") return;

    // Send authorization code to backend for exchange
    const user = await login(provider, "", result.params.code || "");

    if (!user) {
      Alert.alert("로그인 실패", `${provider} 로그인에 실패했습니다`);
      return;
    }

    if (user.is_new) {
      router.replace("/nickname-setup");
    } else {
      router.back();
    }
  };

  const handleGoogleLogin = async () => {
    // Google Sign-In uses @react-native-google-signin/google-signin
    // This requires a development build - implemented as placeholder
    Alert.alert(
      "준비 중",
      "Google 로그인은 EAS Build 후 사용 가능합니다.\n먼저 카카오 또는 애플 로그인을 이용해주세요."
    );
  };

  const handleAppleLogin = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const identityToken = credential.identityToken;
      if (!identityToken) {
        Alert.alert("오류", "Apple 로그인 토큰을 받을 수 없습니다");
        return;
      }

      const user = await login("apple", identityToken);
      if (!user) {
        Alert.alert("로그인 실패", "Apple 로그인에 실패했습니다");
        return;
      }

      if (user.is_new) {
        router.replace("/nickname-setup");
      } else {
        router.back();
      }
    } catch (e: any) {
      if (e.code === "ERR_CANCELED") return;
      Alert.alert("Apple 로그인 실패", e.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeText}>← 뒤로</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>⚾ fullcount.kr</Text>
        <Text style={styles.subtitle}>소셜 로그인으로 시작하기</Text>
        <Text style={styles.description}>
          로그인하면 커뮤니티 기능을 이용할 수 있습니다.
        </Text>

        <View style={styles.buttonGroup}>
          {/* Kakao Login */}
          <Pressable
            style={[styles.socialBtn, { backgroundColor: "#FEE500" }]}
            onPress={() => handleLogin("kakao")}
            disabled={loading !== null}
          >
            {loading === "kakao" ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={[styles.socialBtnText, { color: "#000" }]}>
                카카오 로그인
              </Text>
            )}
          </Pressable>

          {/* Naver Login */}
          <Pressable
            style={[styles.socialBtn, { backgroundColor: "#03C75A" }]}
            onPress={() => handleLogin("naver")}
            disabled={loading !== null}
          >
            {loading === "naver" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.socialBtnText, { color: "#fff" }]}>
                네이버 로그인
              </Text>
            )}
          </Pressable>

          {/* Google Login */}
          <Pressable
            style={[styles.socialBtn, { backgroundColor: theme.card }]}
            onPress={() => handleLogin("google")}
            disabled={loading !== null}
          >
            {loading === "google" ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={[styles.socialBtnText, { color: "#000" }]}>
                Google 로그인
              </Text>
            )}
          </Pressable>

          {/* Apple Login (iOS only) */}
          {Platform.OS === "ios" && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={12}
              style={styles.appleBtn}
              onPress={() => handleLogin("apple")}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  closeBtn: { padding: 8, alignSelf: "flex-start" },
  closeText: { color: theme.mutedForeground, fontSize: 16 },
  body: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  title: { fontSize: 28, fontWeight: "bold", color: theme.foreground, textAlign: "center" },
  subtitle: { fontSize: 16, color: theme.secondaryForeground, textAlign: "center", marginTop: 8 },
  description: {
    fontSize: 13,
    color: theme.mutedForeground,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 40,
  },
  buttonGroup: { gap: 12 },
  socialBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    height: 48,
  },
  socialBtnText: { fontSize: 15, fontWeight: "600" },
  appleBtn: { height: 48, width: "100%" },
});
