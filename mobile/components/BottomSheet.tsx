import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View, Text, Pressable, StyleSheet, type DimensionValue,
  Animated, KeyboardAvoidingView, Platform, BackHandler, PanResponder,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/ThemeContext";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: string;
  showHandle?: boolean;
  swipeToClose?: boolean;
  hardwareBackPress?: boolean;
}

export default function BottomSheet({
  visible,
  onClose,
  children,
  maxHeight = "92%",
  showHandle = true,
  swipeToClose = false,
  hardwareBackPress = true,
}: BottomSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const sheetTranslateY = useRef(new Animated.Value(500)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [shouldRender, setShouldRender] = useState(false);

  // Wrap onClose in ref to avoid stale closures in useEffect/useCallback
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Open animation
  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      sheetTranslateY.setValue(500);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 9,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (shouldRender) {
      // Parent-triggered close (e.g. after successful save)
      Animated.parallel([
        Animated.timing(sheetTranslateY, {
          toValue: 500,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShouldRender(false);
      });
    }
  }, [visible, shouldRender]);

  // Handle close with animation
  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(sheetTranslateY, {
        toValue: 500,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShouldRender(false);
      onCloseRef.current();
    });
  }, [sheetTranslateY, backdropOpacity]);

  // BackHandler (Android hardware back button)
  useEffect(() => {
    if (!hardwareBackPress || !shouldRender) return;
    const handler = () => {
      handleClose();
      return true;
    };
    const subscription = BackHandler.addEventListener("hardwareBackPress", handler);
    return () => subscription.remove();
  }, [shouldRender, handleClose, hardwareBackPress]);

  // PanResponder for swipe-to-dismiss
  const sheetPan = useMemo(() => {
    if (!swipeToClose) return { panHandlers: {} };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 10,
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80) {
          handleClose();
        }
      },
    });
  }, [swipeToClose, handleClose]);

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      position: "absolute",
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 999,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: maxHeight as DimensionValue,
    },
    handleRow: { alignItems: "center", paddingVertical: 16 },
    handle: { width: 48, height: 5, borderRadius: 3, backgroundColor: theme.border },
  }), [theme, maxHeight]);

  if (!shouldRender) return null;

  return (
    <View style={styles.overlay}>
      {/* Backdrop — tap to close */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity, backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <Pressable style={{ flex: 1 }} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ justifyContent: "flex-end" }}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }], paddingBottom: Math.max(insets.bottom, 8) }]}>
          {showHandle && (
            <View style={styles.handleRow} {...sheetPan.panHandlers}>
              <View style={styles.handle} />
            </View>
          )}

          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}
