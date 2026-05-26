import { Pressable, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "@/lib/ThemeContext";

const PERSON_PATH = "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z";

interface Props {
  color?: string;
  style?: ViewStyle;
}

export default function MyButton({ color, style }: Props) {
  const { theme } = useTheme();
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push("/my")} hitSlop={8} style={style}>
      <Svg width="22" height="22" viewBox="0 0 24 24" fill={color || theme.mutedForeground}>
        <Path d={PERSON_PATH} />
      </Svg>
    </Pressable>
  );
}
