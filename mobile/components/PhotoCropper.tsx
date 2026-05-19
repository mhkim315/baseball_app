import { useState, useRef, useMemo, useCallback } from "react";
import {
  View, Text, Pressable, Image, StyleSheet,
  Dimensions, GestureResponderEvent,
} from "react-native";
import { useTheme } from "@/lib/ThemeContext";
import { cropToSquare } from "@/lib/camera";

interface PhotoCropperProps {
  visible: boolean;
  imageUri: string;
  onCrop: (croppedUri: string) => void;
  onCancel: () => void;
}

const CROP_SIZE = Dimensions.get("window").width - 32;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export default function PhotoCropper({ visible, imageUri, onCrop, onCancel }: PhotoCropperProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  const imageRef = useRef<Image>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const imageDisplayRef = useRef({ w: 0, h: 0 });
  const naturalSizeRef = useRef({ w: 0, h: 0 });
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
    offsetRef.current.x = clamp(offsetRef.current.x + dx, -max.x, max.x);
    offsetRef.current.y = clamp(offsetRef.current.y + dy, -max.y, max.y);
    applyTransform();
  }, [getMaxOffset, applyTransform]);

  const handleImageLoad = (e: any) => {
    const { width: imgW, height: imgH } = e.nativeEvent.source;
    naturalSizeRef.current = { w: imgW, h: imgH };
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
      const { w: dispW, h: dispH } = imageDisplayRef.current;
      const offset = offsetRef.current;

      const visLeft = clamp(dispW / 2 - CROP_SIZE / 2 - offset.x, 0, Math.max(0, dispW - CROP_SIZE));
      const visTop = clamp(dispH / 2 - CROP_SIZE / 2 - offset.y, 0, Math.max(0, dispH - CROP_SIZE));
      const visWidth = Math.min(CROP_SIZE, dispW - visLeft);
      const visHeight = Math.min(CROP_SIZE, dispH - visTop);

      const { w: imgNatW, h: imgNatH } = naturalSizeRef.current;
      if (imgNatW === 0 || dispW === 0) {
        onCrop(imageUri);
        return;
      }

      const scaleX = imgNatW / dispW;
      const scaleY = imgNatH / dispH;
      const cropRect = {
        originX: Math.round(visLeft * scaleX),
        originY: Math.round(visTop * scaleY),
        width: Math.round(visWidth * scaleX),
        height: Math.round(visHeight * scaleY),
      };

      const cropped = await cropToSquare(imageUri, cropRect);
      onCrop(cropped);
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
    <View style={styles.overlay}>
      <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 16 }}>
        사진 영역 선택
      </Text>

      <View
        style={styles.guide}
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
        <Pressable style={[styles.btn, styles.cancelBtn]} onPress={onCancel}>
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
  );
}
