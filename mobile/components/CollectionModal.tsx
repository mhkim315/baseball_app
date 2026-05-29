import { useState, useEffect, useCallback } from "react";
import {
  View, Text, Pressable, Modal, TextInput, ScrollView,
  Image, Alert, StyleSheet, KeyboardAvoidingView, Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "@/lib/ThemeContext";
import { teamPrimaryColor } from "@shared/teamColors";
import { useTeam } from "@/lib/TeamContext";
import {
  addCollection, updateCollection, deleteCollection,
  getAllCollections, parseCollectionPhotos,
  addTotem,
  type Collection,
} from "@/lib/db";
import { resizePhoto, savePhoto, generatePhotoName, deletePhoto } from "@/lib/camera";
import EmojiPicker from "@/components/EmojiPicker";
import ColorPicker from "@/components/ColorPicker";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function CollectionModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const { myTeam } = useTeam();
  const teamColor = myTeam ? teamPrimaryColor(myTeam, false) : "#888";

  const [view, setView] = useState<"list" | "detail" | "form" | "totemPopup">("list");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [current, setCurrent] = useState<Collection | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [isEdit, setIsEdit] = useState(false);
  const [fullscreenUri, setFullscreenUri] = useState<string | null>(null);
  const [totemEmoji, setTotemEmoji] = useState("");
  const [totemColor, setTotemColor] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await getAllCollections();
      setCollections(data);
    } catch (e) {
      console.warn("getAllCollections failed", e);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      load();
      setView("list");
      setCurrent(null);
    }
  }, [visible, load]);

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormPhotos([]);
    setIsEdit(false);
  };

  const handleAddPhoto = async () => {
    try {
      const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!granted) {
        Alert.alert("권한 필요", "사진 라이브러리 접근 권한이 필요합니다.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
        allowsMultipleSelection: true,
      });
      if (result.canceled) return;
      for (const asset of result.assets) {
        const resized = await resizePhoto(asset.uri);
        const saved = await savePhoto(resized, generatePhotoName());
        setFormPhotos((prev) => [...prev, saved]);
      }
    } catch (e) {
      console.warn("handleAddPhoto failed", e);
    }
  };

  const handleSave = async () => {
    const name = formName.trim();
    if (!name) return;
    try {
      const photos = formPhotos.length > 0 ? JSON.stringify(formPhotos) : undefined;
      if (isEdit && current) {
        await updateCollection(current.id, { name, description: formDescription.trim() || undefined, photos });
      } else {
        await addCollection(name, formDescription.trim() || undefined, photos);
      }
      await load();
      setView("list");
      resetForm();
    } catch (e) {
      console.warn("collection save failed", e);
    }
  };

  const handleDelete = (c: Collection) => {
    Alert.alert(
      `"${c.name}" 삭제`,
      "이 컬렉션을 삭제할까요? 등록된 토템은 유지됩니다.",
      [
        { text: "취소", style: "cancel" },
        { text: "삭제", style: "destructive", onPress: async () => {
          try {
            const photos = parseCollectionPhotos(c);
            for (const uri of photos) {
              await deletePhoto(uri);
            }
            await deleteCollection(c.id);
            await load();
            setView("list");
          } catch (e) {
            console.warn("deleteCollection failed", e);
          }
        }},
      ]
    );
  };

  const handleTotemRegister = async () => {
    if (!current) return;
    const name = current.name.trim();
    const emoji = totemEmoji || "🍀";
    try {
      await addTotem(name, emoji, current.description ?? undefined, totemColor || undefined);
      Alert.alert("완료", `"${name}"이(가) 토템으로 등록되었습니다.`);
      setView("detail");
      setTotemEmoji("");
      setTotemColor("");
    } catch (e) {
      console.warn("addTotem failed", e);
    }
  };

  const openDetail = (c: Collection) => {
    setCurrent(c);
    setView("detail");
  };

  const openForm = (c?: Collection) => {
    if (c) {
      setCurrent(c);
      setFormName(c.name);
      setFormDescription(c.description || "");
      setFormPhotos(parseCollectionPhotos(c));
      setIsEdit(true);
    } else {
      resetForm();
      setCurrent(null);
    }
    setView("form");
  };

  // -------- LIST VIEW --------
  const renderList = () => (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.foreground }}>컬렉션</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable onPress={() => openForm()}>
            <Text style={{ fontSize: 22, color: theme.foreground }}>+</Text>
          </Pressable>
          <Pressable onPress={onClose}>
            <Text style={{ fontSize: 22, color: theme.mutedForeground }}>✕</Text>
          </Pressable>
        </View>
      </View>
      {collections.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 40, gap: 8 }}>
          <Text style={{ fontSize: 36 }}>📦</Text>
          <Text style={{ fontSize: 14, color: theme.mutedForeground, textAlign: "center" }}>
            아직 등록된 컬렉션 아이템이 없어요.{'\n'}직관 굿즈, 티켓, 기념품을 기록해보세요!
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 12 }}>
            {collections.map((c) => {
              const photos = parseCollectionPhotos(c);
              return (
                <Pressable
                  key={c.id}
                  style={{ flexDirection: "row", gap: 12, alignItems: "center", borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card, padding: 12 }}
                  onPress={() => openDetail(c)}
                >
                  {photos.length > 0 ? (
                    <Image source={{ uri: photos[0] }} style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: theme.muted }} />
                  ) : (
                    <View style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: theme.muted, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 22 }}>📦</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: theme.foreground }} numberOfLines={1}>{c.name}</Text>
                    {c.description && (
                      <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 2 }} numberOfLines={1}>{c.description}</Text>
                    )}
                    <Text style={{ fontSize: 10, color: theme.mutedForeground, marginTop: 2 }}>
                      {c.created_at?.slice(0, 10)} · {photos.length > 0 ? `${photos.length}장` : "사진 없음"}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 20, color: theme.mutedForeground }}>›</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );

  // -------- FORM VIEW --------
  const renderForm = () => (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.foreground, marginBottom: 16, textAlign: "center" }}>
        {isEdit ? "컬렉션 수정" : "새 컬렉션"}
      </Text>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 12, fontWeight: "600", color: theme.mutedForeground, marginBottom: 4 }}>이름 *</Text>
        <TextInput
          style={{ backgroundColor: theme.muted, borderRadius: 12, padding: 14, fontSize: 16, color: theme.foreground, marginBottom: 16 }}
          value={formName}
          onChangeText={setFormName}
          placeholder="아이템 이름"
          placeholderTextColor="#666"
          maxLength={30}
        />

        <Text style={{ fontSize: 12, fontWeight: "600", color: theme.mutedForeground, marginBottom: 4 }}>설명</Text>
        <TextInput
          style={{ backgroundColor: theme.muted, borderRadius: 12, padding: 14, fontSize: 16, color: theme.foreground, marginBottom: 16, minHeight: 80, textAlignVertical: "top" }}
          value={formDescription}
          onChangeText={setFormDescription}
          placeholder="어디서 구했는지, 언제 구매했는지... (선택사항)"
          placeholderTextColor="#666"
          maxLength={200}
          multiline
        />

        <Text style={{ fontSize: 12, fontWeight: "600", color: theme.mutedForeground, marginBottom: 4 }}>사진</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {formPhotos.map((uri, i) => (
            <View key={i} style={{ position: "relative" }}>
              <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 10, backgroundColor: theme.muted }} />
              <Pressable
                onPress={() => setFormPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                style={{ position: "absolute", top: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: "#e74c3c", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>✕</Text>
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={handleAddPhoto}
            style={{ width: 80, height: 80, borderRadius: 10, borderWidth: 2, borderColor: theme.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 24, color: theme.mutedForeground }}>+</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
        <Pressable
          style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: theme.secondary }}
          onPress={() => { setView(isEdit && current ? "detail" : "list"); if (!isEdit) resetForm(); }}
        >
          <Text style={{ fontSize: 14, color: theme.mutedForeground }}>취소</Text>
        </Pressable>
        <Pressable
          style={[{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: theme.foreground }, !formName.trim() && { opacity: 0.4 }]}
          disabled={!formName.trim()}
          onPress={handleSave}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: theme.background }}>저장</Text>
        </Pressable>
      </View>
    </View>
  );

  // -------- DETAIL VIEW --------
  const renderDetail = () => {
    if (!current) return null;
    const photos = parseCollectionPhotos(current);
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 12 }}>
          <Pressable onPress={() => { setCurrent(null); setView("list"); }}>
            <Text style={{ fontSize: 22, color: theme.mutedForeground }}>✕</Text>
          </Pressable>
        </View>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {photos.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 16 }}>
              {photos.map((uri, i) => (
                <Pressable key={i} style={{ width: "31%", aspectRatio: 1 }} onPress={() => setFullscreenUri(uri)}>
                  <Image source={{ uri }} style={{ flex: 1, borderRadius: 8, backgroundColor: theme.muted }} />
                </Pressable>
              ))}
            </View>
          )}

          <Text style={{ fontSize: 20, fontWeight: "bold", color: theme.foreground }}>{current.name}</Text>
          {current.description && (
            <Text style={{ fontSize: 14, color: theme.mutedForeground, marginTop: 8, lineHeight: 20 }}>{current.description}</Text>
          )}
          <Text style={{ fontSize: 11, color: theme.mutedForeground, marginTop: 8 }}>
            등록일 · {current.created_at?.slice(0, 10)}
          </Text>

          <View style={{ gap: 8, marginTop: 24 }}>
            <Pressable
              style={{ alignItems: "center", paddingVertical: 14, borderRadius: 12, backgroundColor: teamColor }}
              onPress={() => { setTotemEmoji(""); setTotemColor(""); setView("totemPopup"); }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>토템으로 등록</Text>
            </Pressable>
            <Pressable
              style={{ alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: theme.muted }}
              onPress={() => openForm(current)}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: theme.foreground }}>수정</Text>
            </Pressable>
            <Pressable
              style={{ alignItems: "center", paddingVertical: 12, borderRadius: 12 }}
              onPress={() => handleDelete(current)}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#e74c3c" }}>삭제</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  };

  // -------- TOTEM POPUP --------
  const renderTotemPopup = () => (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.foreground, marginBottom: 4, textAlign: "center" }}>
        토템으로 등록
      </Text>
      <Text style={{ fontSize: 12, color: theme.mutedForeground, marginBottom: 16, textAlign: "center" }}>
        "{current?.name}"을(를) 승리 토템으로 등록합니다.{'\n'}이모지와 색상을 선택해주세요.
      </Text>

      <Text style={{ fontSize: 12, fontWeight: "600", color: theme.mutedForeground, marginBottom: 4 }}>이모지</Text>
      <EmojiPicker selected={totemEmoji} onSelect={setTotemEmoji} />

      <Text style={{ fontSize: 12, fontWeight: "600", color: theme.mutedForeground, marginBottom: 4 }}>색상</Text>
      <ColorPicker selected={totemColor} onSelect={setTotemColor} />

      <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
        <Pressable style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: theme.secondary }} onPress={() => setView("detail")}>
          <Text style={{ fontSize: 14, color: theme.mutedForeground }}>취소</Text>
        </Pressable>
        <Pressable
          style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: theme.foreground }}
          onPress={handleTotemRegister}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: theme.background }}>등록</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.overlay}>
            <View style={[styles.content, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {view === "list" && renderList()}
              {view === "form" && renderForm()}
              {view === "detail" && renderDetail()}
              {view === "totemPopup" && renderTotemPopup()}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Fullscreen photo viewer */}
      <Modal visible={!!fullscreenUri} transparent animationType="fade" onRequestClose={() => setFullscreenUri(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" }}
          onPress={() => setFullscreenUri(null)}
        >
          {fullscreenUri && (
            <Image source={{ uri: fullscreenUri }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
          )}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  content: {
    maxHeight: "85%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 24,
    paddingBottom: 40,
  },
});
