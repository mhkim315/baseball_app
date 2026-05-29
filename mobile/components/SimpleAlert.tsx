import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { useTheme } from "@/lib/ThemeContext";

interface SimpleAlertProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  onConfirm?: () => void;
  cancelText?: string;
  onCancel?: () => void;
  onClose: () => void;
}

export default function SimpleAlert({
  visible, title, message,
  confirmText = "확인", onConfirm, cancelText, onCancel, onClose,
}: SimpleAlertProps) {
  const { theme } = useTheme();

  const handleConfirm = () => {
    onClose();
    onConfirm?.();
  };

  const handleCancel = () => {
    onClose();
    onCancel?.();
  };

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <View style={s.overlay}>
        <View style={[s.card, { backgroundColor: theme.card }]}>
          <Text style={[s.title, { color: theme.foreground }]}>{title}</Text>
          <Text style={[s.message, { color: theme.mutedForeground }]}>{message}</Text>
          {cancelText ? (
            <View style={s.buttonRow}>
              <Pressable style={[s.cancelBtn, s.btnInRow, { borderColor: theme.border }]} onPress={handleCancel}>
                <Text style={[s.cancelText, { color: theme.mutedForeground }]}>{cancelText}</Text>
              </Pressable>
              <Pressable style={[s.confirmBtn, s.btnInRow, { backgroundColor: theme.foreground }]} onPress={handleConfirm}>
                <Text style={[s.confirmText, { color: theme.background }]}>{confirmText}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={[s.confirmBtn, s.confirmSingle, { backgroundColor: theme.foreground }]} onPress={handleConfirm}>
              <Text style={[s.confirmText, { color: theme.background }]}>{confirmText}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    borderRadius: 18,
    padding: 28,
    minWidth: 280,
    maxWidth: 320,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    alignSelf: "stretch",
  },
  confirmBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmSingle: {
    alignSelf: "stretch",
  },
  btnInRow: {
    flex: 1,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: "700",
  },
  cancelBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
