import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { TEAM_COLORS } from "@shared/teamColors";
import { useTheme } from "@/lib/ThemeContext";

const IMAGE_BASE = "https://fullcount.kr";

interface TeamBadgeProps {
  teamId: string;
  size?: "sm" | "md" | "lg";
  emotion?: "default" | "determined" | "sad" | "joyful" | "neutral";
  variant?: "character" | "ball" | "bat";
}

const sizePx = { sm: 32, md: 48, lg: 64 };
const textSize = { sm: 9, md: 12, lg: 14 };

export function TeamBadge({ teamId, size = "md", emotion = "default", variant = "character" }: TeamBadgeProps) {
  const team = TEAM_COLORS[teamId];
  const { isDark } = useTheme();
  const [imgFailed, setImgFailed] = useState(false);
  if (!team) return null;

  const px = sizePx[size];

  if (variant === "character") {
    const imgSrc = `${IMAGE_BASE}/team-characters/${teamId}_${emotion}.png`;
    const bgColor = hexToRgba(isDark && team.primaryLight ? team.primaryLight : team.primary, 0.35);

    return (
      <View style={[styles.characterContainer, { width: px, height: px, borderRadius: px / 2, backgroundColor: bgColor }]}>
        {imgFailed ? (
          <Text style={[styles.fallbackText, { color: team.secondary, fontSize: textSize[size] }]}>
            {team.shortName}
          </Text>
        ) : (
          <Image
            source={imgSrc}
            style={{ width: px, height: px, borderRadius: px / 2 }}
            contentFit="cover"
            onError={() => setImgFailed(true)}
          />
        )}
      </View>
    );
  }

  // Ball or bat icon
  const imgSrc = variant === "ball"
    ? `${IMAGE_BASE}/team-ball/${teamId}.png`
    : `${IMAGE_BASE}/team-bat/${teamId}.png`;

  const iconW = variant === "bat" ? 40 : 24;
  const iconH = variant === "bat" ? 24 : 24;

  return (
    <View style={{ width: px, height: px, justifyContent: "center", alignItems: "center" }}>
      {imgFailed ? (
        <Text style={[styles.fallbackText, { color: team.secondary, fontSize: textSize[size] }]}>
          {team.shortName}
        </Text>
      ) : (
        <Image
          source={imgSrc}
          style={{ width: iconW, height: iconH }}
          contentFit="contain"
          onError={() => setImgFailed(true)}
        />
      )}
    </View>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const styles = StyleSheet.create({
  characterContainer: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  fallbackText: {
    fontWeight: "bold",
  },
});
