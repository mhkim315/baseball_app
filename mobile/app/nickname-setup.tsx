import { useState, useMemo } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/AuthContext";
import { updateNickname } from "@/lib/auth";
import { useTheme } from "@/lib/ThemeContext";

export default function NicknameSetupScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      Alert.alert("알림", "닉네임을 입력해주세요");
      return;
    }
    if (trimmed.length > 20) {
      Alert.alert("알림", "닉네임은 20자 이내로 입력해주세요");
      return;
    }

    setSubmitting(true);
    try {
      const ok = await updateNickname(trimmed);
      if (ok) {
        await refreshUser();
        Alert.alert("완료", `${trimmed}님, 환영합니다!`, [
          { text: "시작하기", onPress: () => router.dismissAll() },
        ]);
      } else {
        Alert.alert("오류", "닉네임 설정에 실패했습니다");
      }
    } catch {
      Alert.alert("오류", "네트워크 오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    body: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 32,
      paddingBottom: 80,
    },
    title: { fontSize: 48, textAlign: "center", marginBottom: 16 },
    heading: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.foreground,
      textAlign: "center",
      marginBottom: 8,
    },
    description: {
      fontSize: 13,
      color: theme.mutedForeground,
      textAlign: "center",
      marginBottom: 32,
    },
    input: {
      backgroundColor: theme.muted,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: theme.foreground,
      marginBottom: 16,
      textAlign: "center",
    },
    submitBtn: {
      backgroundColor: theme.foreground,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    submitDisabled: { opacity: 0.4 },
    submitText: { fontSize: 16, fontWeight: "600", color: theme.background },
  }), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <Text style={styles.title}>⚾</Text>
        <Text style={styles.heading}>사용할 닉네임을 입력해주세요</Text>
        <Text style={styles.description}>
          다른 사용자에게 표시되는 이름입니다.
        </Text>

        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
          placeholder="닉네임 (최대 20자)"
          placeholderTextColor="#666"
          maxLength={20}
          autoFocus
        />

        <Pressable
          style={[styles.submitBtn, !nickname.trim() && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !nickname.trim()}
        >
          {submitting ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.submitText}>완료</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
