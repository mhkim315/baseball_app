import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/AuthContext";
import { fetchPosts, logout, type PostSummary } from "@/lib/auth";
import { useTheme } from "@/lib/ThemeContext";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "방금 전";
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

export default function CommunityIndexScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { user, isAuthenticated, logout: authLogout } = useAuth();
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadPosts = useCallback(async (pageNum = 1, append = false) => {
    try {
      const data = await fetchPosts(pageNum);
      if (data) {
        if (append) {
          setPosts((prev) => [...prev, ...data.posts]);
        } else {
          setPosts(data.posts);
        }
        setHasMore(pageNum * data.page_size < data.total);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    loadPosts(1);
  };

  const handleLoadMore = () => {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    loadPosts(next, true);
  };

  const handleWrite = () => {
    if (!isAuthenticated) {
      Alert.alert("로그인 필요", "커뮤니티 이용을 위해 로그인이 필요합니다");
      return;
    }
    router.push("/community/create");
  };

  const handleLogout = () => {
    Alert.alert("로그아웃", "로그아웃할까요?", [
      { text: "취소", style: "cancel" },
      { text: "로그아웃", onPress: authLogout },
    ]);
  };

  const renderPost = ({ item }: { item: PostSummary }) => (
    <Pressable
      style={styles.postCard}
      onPress={() => router.push(`/community/${item.id}`)}
    >
      <Text style={styles.postTitle} numberOfLines={1}>{item.title}</Text>
      <View style={styles.postMeta}>
        <Text style={styles.postAuthor}>
          {item.author_deleted ? "탈퇴한 회원" : item.author_nickname}
        </Text>
        <Text style={styles.postDate}>{formatDate(item.created_at)}</Text>
        {item.comment_count > 0 && (
          <Text style={styles.postComments}>댓글 {item.comment_count}</Text>
        )}
      </View>
    </Pressable>
  );

  const renderLoginPrompt = () => (
    <Pressable style={styles.loginPrompt} onPress={() => router.push("/login")}>
      <Text style={styles.loginTitle}>커뮤니티</Text>
      <Text style={styles.loginSub}>소셜 로그인 후 게시글을 읽고 쓸 수 있어요</Text>
      <View style={styles.loginPromptBtn}>
        <Text style={styles.loginPromptText}>로그인하기</Text>
      </View>
    </Pressable>
  );

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingTop: 60,
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: { fontSize: 24, fontWeight: "bold", color: theme.foreground },
    headerSub: { fontSize: 13, color: theme.mutedForeground, marginTop: 2 },
    headerActions: { flexDirection: "row", gap: 8, alignItems: "center" },
    logoutBtn: { paddingVertical: 6, paddingHorizontal: 10 },
    logoutText: { color: theme.mutedForeground, fontSize: 12 },
    loginBtn: { paddingVertical: 6, paddingHorizontal: 12 },
    loginText: { color: theme.info, fontSize: 13, fontWeight: "600" },
    writeBtn: {
      backgroundColor: theme.foreground,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
    },
    writeText: { fontSize: 13, fontWeight: "600", color: theme.background },
    listContent: { paddingBottom: 40 },
    postCard: { padding: 16 },
    postTitle: { fontSize: 15, fontWeight: "600", color: theme.foreground, marginBottom: 6 },
    postMeta: { flexDirection: "row", gap: 10, alignItems: "center" },
    postAuthor: { fontSize: 12, color: theme.mutedForeground },
    postDate: { fontSize: 11, color: theme.mutedForeground },
    postComments: { fontSize: 11, color: theme.info },
    loginPrompt: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 40,
    },
    loginTitle: { fontSize: 20, fontWeight: "bold", color: theme.foreground, marginBottom: 8 },
    loginSub: { fontSize: 14, color: theme.mutedForeground, textAlign: "center", marginBottom: 20 },
    loginPromptBtn: {
      backgroundColor: theme.foreground,
      paddingVertical: 10,
      paddingHorizontal: 24,
      borderRadius: 20,
    },
    loginPromptText: { fontSize: 14, fontWeight: "600", color: theme.background },
    loadingContainer: { paddingVertical: 60, alignItems: "center" },
    emptyContainer: { paddingVertical: 60, alignItems: "center" },
    emptyText: { color: theme.mutedForeground, fontSize: 14 },
  }), [theme]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>커뮤니티</Text>
          <Text style={styles.headerSub}>야구 팬들과 이야기해보세요</Text>
        </View>
        <View style={styles.headerActions}>
          {isAuthenticated ? (
            <Pressable onPress={handleLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>로그아웃</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => router.push("/login")} style={styles.loginBtn}>
              <Text style={styles.loginText}>로그인</Text>
            </Pressable>
          )}
          <Pressable onPress={handleWrite} style={styles.writeBtn}>
            <Text style={styles.writeText}>글쓰기</Text>
          </Pressable>
        </View>
      </View>

      {isAuthenticated ? (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.foreground} />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>첫 게시글을 작성해보세요!</Text>
              </View>
            )
          }
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.border }} />}
        />
      ) : (
        renderLoginPrompt()
      )}
    </View>
  );
}

