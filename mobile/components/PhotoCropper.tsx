import { useState, useRef, useMemo, useCallback } from "react";
import {
  Modal, View, Text, Pressable, Image, StyleSheet,
  Dimensions, GestureResponderEvent, NativeSyntheticEvent, ImageLoadEventData,
} from "react-native";
import { useTheme } from "@/lib/ThemeContext";
import { captureRef } from "react-native-view-shot";
import * as FileSystem from "expo-file-system/legacy";

interface PhotoCropperProps {
  visible: boolean;
  imageUri: string;
  onCrop: (croppedUri: string) => void;
  onCancel: () => void;
}

const CROP_SIZE = Dimensions.get("window").width - 32;

export default function PhotoCropper({ visible, imageUri, onCrop, onCancel }: PhotoCropperProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  const guideRef = useRef<View>(null);
  const imageRef = useRef<Image>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const imageDisplayRef = useRef({ w: 0, h: 0 });
  const lastTouchRef = useRef({ x: 0, y: 0 });

  const getMaxOffset = useCallback(() => {
    const { w, h } = imageDisplayRef.current;
    return {
      x: Math.max(0, (w - CROP_SIZE) / 2),
      y: Math.max(0, (h - CROP_SIZE) / 2),
    };
  }, []);

  const applyTransform = useCallback(() => {
    const { x, y } = offsetRef.current;
    imageRef.current?.setNativeProps({
      style: { transform: [{ translateX: x }, { translateY: y }] },
    });
  }, []);

  const handleTouchStart = useCallback((evt: GestureResponderEvent) => {
    const touch = evt.nativeEvent;
    lastTouchRef.current = { x: touch.pageX, y: touch.pageY };
  }, []);

  const handleTouchMove = useCallback((evt: GestureResponderEvent) => {
    const touch = evt.nativeEvent;
    const dx = touch.pageX - lastTouchRef.current.x;
    const dy = touch.pageY - lastTouchRef.current.y;
    lastTouchRef.current = { x: touch.pageX, y: touch.pageY };

    const max = getMaxOffset();
    offsetRef.current.x = Math.max(-max.x, Math.min(max.x, offsetRef.current.x + dx));
    offsetRef.current.y = Math.max(-max.y, Math.min(max.y, offsetRef.current.y + dy));
    applyTransform();
  }, [getMaxOffset, applyTransform]);

  const handleImageLoad = (e: NativeSyntheticEvent<ImageLoadEventData>) => {
    const { width: imgW, height: imgH } = e.nativeEvent.source;
    const scale = Math.max(CROP_SIZE / imgW, CROP_SIZE / imgH);
    const dispW = imgW * scale;
    const dispH = imgH * scale;
    imageDisplayRef.current = { w: dispW, h: dispH };
    setImageSize({ width: dispW, height: dispH });
    offsetRef.current = { x: 0, y: 0 };
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const uri = await captureRef(guideRef, { format: "jpg", quality: 0.92 });
      const destDir = `${FileSystem.documentDirectory}jikgwan/`;
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
      const permUri = `${destDir}crop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
      await FileSystem.copyAsync({ from: uri, to: permUri });
      onCrop(permUri);
    } catch {
      onCrop(imageUri);
    } finally {
      setLoading(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.85)",
      zIndex: 1000,
      elevation: 5,
      shadowColor: "transparent",
      justifyContent: "center",
      alignItems: "center",
    },
    guide: {
      width: CROP_SIZE,
      height: CROP_SIZE,
      overflow: "hidden",
      borderRadius: 4,
      borderWidth: 2,
      borderColor: "#fff",
    },
    hint: {
      color: "#fff",
      fontSize: 13,
      textAlign: "center",
      marginTop: 16,
      opacity: 0.7,
    },
    bottomRow: {
      flexDirection: "row",
      gap: 16,
      marginTop: 32,
    },
    btn: {
      paddingVertical: 14,
      paddingHorizontal: 40,
      borderRadius: 14,
      minWidth: 120,
      alignItems: "center",
    },
    cancelBtn: {
      backgroundColor: "#555",
    },
    confirmBtn: {
      backgroundColor: theme.foreground,
    },
    btnText: {
      fontSize: 15,
      fontWeight: "700",
    },
    confirmText: {
      color: theme.background,
    },
    cancelText: {
      color: "#fff",
    },
  }), [theme]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.overlay}>
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 16 }}>
          사진 영역 선택
        </Text>

        <View
          ref={guideRef}
          style={styles.guide}
          collapsable={false}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
        >
          <Image
            ref={imageRef}
            source={{ uri: imageUri }}
            style={[{
              width: imageSize.width || CROP_SIZE,
              height: imageSize.height || CROP_SIZE,
              position: "absolute",
              top: (CROP_SIZE - (imageSize.height || CROP_SIZE)) / 2,
              left: (CROP_SIZE - (imageSize.width || CROP_SIZE)) / 2,
              opacity: imageSize.width > 0 ? 1 : 0,
            }]}
            onLoad={handleImageLoad}
          />
        </View>

        <Text style={styles.hint}>드래그하여 위치 조정</Text>

        <View style={styles.bottomRow}>
          <Pressable style={[styles.btn, styles.cancelBtn]} onPress={onCancel} hitSlop={8}>
            <Text style={[styles.btnText, styles.cancelText]}>취소</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.confirmBtn]}
            onPress={handleConfirm}
            disabled={loading}
          >
            <Text style={[styles.btnText, styles.confirmText]}>
              {loading ? "처리중..." : "확인"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
