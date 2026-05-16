import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { createPost, getToken } from "@/lib/auth";
import { theme } from "@/lib/theme";

export default function CreatePostScreen() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert("알림", "제목을 입력해주세요");
      return;
    }
    if (!content.trim()) {
      Alert.alert("알림", "내용을 입력해주세요");
      return;
    }

    const token = await getToken();
    if (!token) {
      Alert.alert("로그인 필요", "커뮤니티 이용을 위해 로그인이 필요합니다");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createPost(title.trim(), content.trim());
      if (result) {
        Alert.alert("완료", "게시글이 작성되었습니다", [
          { text: "확인", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("오류", "게시글 작성에 실패했습니다");
      }
    } catch {
      Alert.alert("오류", "네트워크 오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeText}>취소</Text>
        </Pressable>
        <Text style={styles.headerTitle}>글쓰기</Text>
        <Pressable onPress={handleSubmit} disabled={submitting} style={styles.submitBtn}>
          {submitting ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.submitText}>완료</Text>
          )}
        </Pressable>
      </View>

      {/* Form */}
      <TextInput
        style={styles.titleInput}
        placeholder="제목"
        placeholderTextColor="#666"
        value={title}
        onChangeText={setTitle}
        maxLength={100}
      />
      <View style={styles.divider} />
      <TextInput
        style={styles.contentInput}
        placeholder="내용을 입력하세요"
        placeholderTextColor="#666"
        value={content}
        onChangeText={setContent}
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  closeBtn: { padding: 8 },
  closeText: { color: theme.mutedForeground, fontSize: 16 },
  headerTitle: { fontSize: 17, fontWeight: "600", color: theme.foreground },
  submitBtn: { padding: 8 },
  submitText: { color: theme.primary, fontSize: 16, fontWeight: "600" },
  titleInput: {
    padding: 16,
    fontSize: 18,
    color: theme.foreground,
    fontWeight: "600",
  },
  divider: { height: 1, backgroundColor: theme.border, marginHorizontal: 16 },
  contentInput: {
    flex: 1,
    padding: 16,
    fontSize: 15,
    color: theme.foreground,
    lineHeight: 22,
  },
});
