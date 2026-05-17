import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { TeamBadge } from "@/components/TeamBadge";
import { useTheme } from "@/lib/ThemeContext";
import {
  fetchPostDetail,
  createComment,
  deletePost as apiDeletePost,
  deleteComment as apiDeleteComment,
  getToken,
  getUser,
  type PostDetail,
} from "@/lib/auth";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function PostDetailScreen() {
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const loadPost = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPostDetail(parseInt(id!));
      setPost(data);
    } catch {
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPost();
    getUser().then((u) => setMyUserId(u?.user_id || null));
  }, [loadPost]);

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    const token = await getToken();
    if (!token) {
      Alert.alert("로그인 필요", "댓글 작성은 로그인이 필요합니다");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createComment(parseInt(id!), commentText.trim());
      if (result) {
        setCommentText("");
        loadPost();
      } else {
        Alert.alert("오류", "댓글 작성에 실패했습니다");
      }
    } catch {
      Alert.alert("오류", "네트워크 오류");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = () => {
    Alert.alert("삭제", "이 게시글을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제", style: "destructive",
        onPress: async () => {
          await apiDeletePost(parseInt(id!));
          router.back();
        },
      },
    ]);
  };

  const handleDeleteComment = (commentId: number) => {
    Alert.alert("삭제", "댓글을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제", style: "destructive",
        onPress: async () => {
          await apiDeleteComment(commentId);
          loadPost();
        },
      },
    ]);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    loadingContainer: { flex: 1, backgroundColor: theme.background, justifyContent: "center", alignItems: "center" },
    errorText: { color: theme.mutedForeground, fontSize: 14, marginBottom: 16 },
    backBtn: { padding: 12 },
    backBtnText: { color: theme.foreground, fontSize: 14 },
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
    backButton: { padding: 8 },
    backText: { color: theme.mutedForeground, fontSize: 16 },
    headerTitle: { fontSize: 17, fontWeight: "600", color: theme.foreground },
    headerRight: { width: 60 },
    scroll: { flex: 1 },
    postSection: { padding: 20 },
    postTitle: { fontSize: 20, fontWeight: "bold", color: theme.foreground, lineHeight: 28 },
    meta: { color: theme.mutedForeground, fontSize: 12, marginTop: 8 },
    divider: { height: 1, backgroundColor: theme.border, marginVertical: 16 },
    content: { fontSize: 15, color: theme.foreground, lineHeight: 24 },
    commentSection: { padding: 20, borderTopWidth: 1, borderTopColor: theme.border },
    commentSectionTitle: { fontSize: 15, fontWeight: "600", color: theme.foreground, marginBottom: 12 },
    noComments: { color: theme.mutedForeground, fontSize: 13, textAlign: "center", paddingVertical: 24 },
    commentCard: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
    commentHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
    commentAuthor: { color: theme.foreground, fontSize: 13, fontWeight: "600" },
    commentDate: { color: theme.mutedForeground, fontSize: 11 },
    commentContent: { color: theme.foreground, fontSize: 14, lineHeight: 20 },
    commentInputBar: {
      flexDirection: "row",
      alignItems: "flex-end",
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.card,
      gap: 8,
    },
    commentInput: {
      flex: 1,
      backgroundColor: theme.muted,
      borderRadius: 12,
      padding: 12,
      color: theme.foreground,
      fontSize: 14,
      maxHeight: 80,
    },
    sendBtn: { padding: 10 },
    sendText: { color: theme.foreground, fontSize: 14, fontWeight: "600" },
    sendDisabled: { opacity: 0.4 },
  }), [theme]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>게시글을 불러올 수 없습니다</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  const isMine = post.author_nickname === myUserId; // simplified check

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← 목록</Text>
        </Pressable>
        <Text style={styles.headerTitle}>게시글</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scroll}>
        {/* Post content */}
        <View style={styles.postSection}>
          <Text style={styles.postTitle}>{post.title}</Text>
          <Text style={styles.meta}>
            {post.author_nickname} · {formatDate(post.created_at)}
            {post.updated_at && " (수정됨)"}
          </Text>
          <View style={styles.divider} />
          <Text style={styles.content}>{post.content}</Text>
        </View>

        {/* Comments */}
        <View style={styles.commentSection}>
          <Text style={styles.commentSectionTitle}>
            댓글 {post.comments.length}개
          </Text>
          {post.comments.length === 0 ? (
            <Text style={styles.noComments}>첫 댓글을 작성해보세요</Text>
          ) : (
            post.comments.map((c) => (
              <View key={c.id} style={styles.commentCard}>
                <View style={styles.commentHeader}>
                  <Text style={styles.commentAuthor}>
                    {c.author_deleted ? "탈퇴한 회원" : c.author_nickname}
                  </Text>
                  <Text style={styles.commentDate}>{formatDate(c.created_at)}</Text>
                </View>
                <Text style={styles.commentContent}>{c.content}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Comment input */}
      <View style={styles.commentInputBar}>
        <TextInput
          style={styles.commentInput}
          placeholder="댓글 작성..."
          placeholderTextColor="#666"
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
        />
        <Pressable onPress={handleAddComment} disabled={submitting || !commentText.trim()} style={styles.sendBtn}>
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={[styles.sendText, !commentText.trim() && styles.sendDisabled]}>전송</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
