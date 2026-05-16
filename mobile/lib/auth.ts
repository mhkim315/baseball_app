import * as SecureStore from "expo-secure-store";

const API_BASE = "https://api.fullcount.kr";
const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export interface AuthUser {
  user_id: string;
  provider: string;
  nickname: string;
  is_new: boolean;
}

// --- Token management ---

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getUser(): Promise<AuthUser | null> {
  const data = await SecureStore.getItemAsync(USER_KEY);
  return data ? JSON.parse(data) : null;
}

export async function setUser(user: AuthUser): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function clearUser(): Promise<void> {
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function logout(): Promise<void> {
  await clearToken();
  await clearUser();
}

// --- API calls ---

async function apiPost<T>(path: string, body: any, auth = false): Promise<T | null> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (auth) {
      const token = await getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function apiGet<T>(path: string, auth = false): Promise<T | null> {
  try {
    const headers: Record<string, string> = {};
    if (auth) {
      const token = await getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}${path}`, { headers });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function apiDelete<T>(path: string, auth = false): Promise<T | null> {
  try {
    const headers: Record<string, string> = {};
    if (auth) {
      const token = await getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}${path}`, { method: "DELETE", headers });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// --- Auth ---

export async function loginWithProvider(provider: string, accessToken = "", authorizationCode = ""): Promise<AuthUser | null> {
  const body: Record<string, string> = { provider };
  if (accessToken) body.access_token = accessToken;
  if (authorizationCode) body.authorization_code = authorizationCode;
  const result = await apiPost<{ token: string; user_id: string; provider: string; nickname: string; is_new: boolean }>(
    "/api/auth/login",
    body,
  );
  if (!result) return null;
  await setToken(result.token);
  const user: AuthUser = {
    user_id: result.user_id,
    provider: result.provider,
    nickname: result.nickname,
    is_new: result.is_new,
  };
  await setUser(user);
  return user;
}

export async function registerWithProvider(provider: string, accessToken = "", nickname: string, authorizationCode = ""): Promise<AuthUser | null> {
  const body: Record<string, string> = { provider, nickname };
  if (accessToken) body.access_token = accessToken;
  if (authorizationCode) body.authorization_code = authorizationCode;
  const result = await apiPost<{ token: string; user_id: string; provider: string; nickname: string; is_new: boolean }>(
    "/api/auth/register",
    body,
  );
  if (!result) return null;
  await setToken(result.token);
  const user: AuthUser = {
    user_id: result.user_id,
    provider: result.provider,
    nickname: result.nickname,
    is_new: result.is_new,
  };
  await setUser(user);
  return user;
}

// --- Community ---

export interface PostSummary {
  id: number;
  title: string;
  author_nickname: string;
  author_deleted: boolean;
  comment_count: number;
  created_at: string;
}

export interface CommentDetail {
  id: number;
  content: string;
  author_nickname: string;
  author_deleted: boolean;
  created_at: string;
}

export interface PostDetail {
  id: number;
  title: string;
  content: string;
  author_nickname: string;
  author_deleted: boolean;
  author_profile_type: string;
  author_profile_value: string | null;
  created_at: string;
  updated_at: string | null;
  comments: CommentDetail[];
}

export interface PostListResponse {
  posts: PostSummary[];
  total: number;
  page: number;
  page_size: number;
}

export async function fetchPosts(page = 1, pageSize = 20): Promise<PostListResponse | null> {
  return apiGet<PostListResponse>(`/api/community/posts?page=${page}&page_size=${pageSize}`);
}

export async function fetchPostDetail(postId: number): Promise<PostDetail | null> {
  return apiGet<PostDetail>(`/api/community/posts/${postId}`);
}

export async function createPost(title: string, content: string): Promise<{ id: number } | null> {
  return apiPost<{ id: number }>("/api/community/posts", { title, content }, true);
}

export async function updatePost(postId: number, title: string, content: string): Promise<{ message: string } | null> {
  return apiPost<{ message: string }>(`/api/community/posts/${postId}`, { title, content }, true);
}

export async function deletePost(postId: number): Promise<{ message: string } | null> {
  // PUT with method override
  return apiDelete<{ message: string }>(`/api/community/posts/${postId}`, true);
}

export async function createComment(postId: number, content: string): Promise<{ id: number } | null> {
  return apiPost<{ id: number }>(`/api/community/posts/${postId}/comments`, { content }, true);
}

export async function deleteComment(commentId: number): Promise<{ message: string } | null> {
  return apiDelete<{ message: string }>(`/api/community/comments/${commentId}`, true);
}

export async function deleteAccount(): Promise<{ message: string } | null> {
  return apiDelete<{ message: string }>("/api/auth/delete-account", true);
}

export async function updateNickname(nickname: string): Promise<boolean> {
  try {
    const token = await getToken();
    if (!token) return false;
    const res = await fetch(`${API_BASE}/api/auth/nickname`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ nickname }),
    });
    if (!res.ok) return false;
    const user = await getUser();
    if (user) {
      user.nickname = nickname;
      await setUser(user);
    }
    return true;
  } catch {
    return false;
  }
}

export async function exportData(): Promise<any | null> {
  return apiGet<any>("/api/auth/export-data", true);
}
