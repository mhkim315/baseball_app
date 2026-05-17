import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/lib/ThemeContext";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = "확인",
  cancelLabel = "취소",
  destructive,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { theme } = useTheme();
  if (!visible) return null;

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 999,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 24,
      width: "80%",
      maxWidth: 300,
      gap: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    title: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.foreground,
      textAlign: "center",
    },
    message: {
      fontSize: 14,
      color: theme.mutedForeground,
      textAlign: "center",
      lineHeight: 20,
    },
    actions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 4,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
    },
    cancelText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.foreground,
    },
    confirmBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: theme.foreground,
      alignItems: "center",
    },
    confirmText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.background,
    },
    destructiveBtn: {
      backgroundColor: "#dc2626",
    },
    destructiveText: {
      color: "#fff",
    },
  }), [theme]);

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.actions}>
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </Pressable>
          <Pressable style={[styles.confirmBtn, destructive && styles.destructiveBtn]} onPress={onConfirm}>
            <Text style={[styles.confirmText, destructive && styles.destructiveText]}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

