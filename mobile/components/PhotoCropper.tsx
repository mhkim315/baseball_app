import { useState, useRef, useMemo } from "react";
import {
  View, Text, Pressable, Image, StyleSheet,
  PanResponder, Dimensions,
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
const SCALE = 1.5;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

function getDistance(touches: any[]): number {
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

export default function PhotoCropper({ visible, imageUri, onCrop, onCancel }: PhotoCropperProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [zoomPct, setZoomPct] = useState(100);

  const imageRef = useRef<Image>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const imageDisplayRef = useRef({ w: 0, h: 0 });
  const scaleRef = useRef(1);

  // Pan baseline
  const panOriginX = useRef(0);
  const panOriginY = useRef(0);

  // Pinch baseline
  const pinchStartDist = useRef(0);
  const pinchStartScale = useRef(1);

  const getMaxOffset = () => {
    const { w, h } = imageDisplayRef.current;
    const s = scaleRef.current;
    return {
      x: Math.max(0, (w * s - CROP_SIZE) / 2),
      y: Math.max(0, (h * s - CROP_SIZE) / 2),
    };
  };

  const applyTransform = () => {
    const { x, y } = offsetRef.current;
    const s = scaleRef.current;
    imageRef.current?.setNativeProps({
      style: {
        transform: [
          { translateX: x },
          { translateY: y },
          { scale: s },
        ],
      },
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        panOriginX.current = offsetRef.current.x;
        panOriginY.current = offsetRef.current.y;
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length >= 2) {
          pinchStartDist.current = getDistance(touches as any);
          pinchStartScale.current = scaleRef.current;
        } else {
          pinchStartDist.current = 0;
        }
      },
      onPanResponderMove: (evt, gs) => {
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length >= 2 && pinchStartDist.current > 0) {
          // Pinch mode
          const dist = getDistance(touches as any);
          if (dist > 0 && pinchStartDist.current > 0) {
            const ratio = dist / pinchStartDist.current;
            const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStartScale.current * ratio));
            scaleRef.current = newScale;
            const max = getMaxOffset();
            offsetRef.current.x = Math.max(-max.x, Math.min(max.x, offsetRef.current.x));
            offsetRef.current.y = Math.max(-max.y, Math.min(max.y, offsetRef.current.y));
            applyTransform();
            setZoomPct(Math.round(newScale * 100));
          }
        } else {
          // Pan mode
          const max = getMaxOffset();
          offsetRef.current.x = Math.max(-max.x, Math.min(max.x, panOriginX.current + gs.dx));
          offsetRef.current.y = Math.max(-max.y, Math.min(max.y, panOriginY.current + gs.dy));
          applyTransform();
        }
      },
      onPanResponderRelease: () => {
        panOriginX.current = offsetRef.current.x;
        panOriginY.current = offsetRef.current.y;
        pinchStartDist.current = 0;
      },
    })
  ).current;

  const handleImageLoad = (e: any) => {
    const { width: imgW, height: imgH } = e.nativeEvent.source;
    const scale = Math.max(CROP_SIZE / imgW, CROP_SIZE / imgH) * SCALE;
    const dispW = imgW * scale;
    const dispH = imgH * scale;
    imageDisplayRef.current = { w: dispW, h: dispH };
    setImageSize({ width: dispW, height: dispH });
    offsetRef.current = { x: 0, y: 0 };
    scaleRef.current = 1;
    pinchStartScale.current = 1;
    setZoomPct(100);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { w: dispW, h: dispH } = imageDisplayRef.current;
      const offset = offsetRef.current;
      const s = scaleRef.current;

      const visLeft = Math.max(0, Math.min(dispW - CROP_SIZE / s, dispW / 2 - CROP_SIZE / (2 * s) - offset.x / s));
      const visTop = Math.max(0, Math.min(dispH - CROP_SIZE / s, dispH / 2 - CROP_SIZE / (2 * s) - offset.y / s));
      const visWidth = Math.min(CROP_SIZE / s, dispW - visLeft);
      const visHeight = Math.min(CROP_SIZE / s, dispH - visTop);

      const imgInfo = await new Promise<{ width: number; height: number }>((resolve) => {
        Image.getSize(imageUri, (w, h) => resolve({ width: w, height: h }), () => resolve({ width: 0, height: 0 }));
      });
      if (imgInfo.width === 0 || dispW === 0) {
        onCrop(imageUri);
        return;
      }

      const scaleX = imgInfo.width / dispW;
      const scaleY = imgInfo.height / dispH;
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
      zIndex: 200,
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
    zoomText: {
      color: "#fff",
      fontSize: 12,
      textAlign: "center",
      marginTop: 4,
      opacity: 0.5,
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
    loadingText: {
      color: "#fff",
      fontSize: 14,
      marginTop: 16,
    },
  }), [theme]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 16 }}>
        사진 영역 선택
      </Text>

      <View style={styles.guide} {...panResponder.panHandlers}>
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

      <Text style={styles.hint}>핀치하여 확대/축소, 드래그하여 위치 조정</Text>
      <Text style={styles.zoomText}>{zoomPct}%</Text>

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
