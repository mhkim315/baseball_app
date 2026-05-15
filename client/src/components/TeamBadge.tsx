import { useState, useMemo } from "react";
import { TEAM_COLORS } from "@/lib/teamColors";
import { config } from "@/lib/config";

interface TeamBadgeProps {
  teamId: string;
  size?: "sm" | "md" | "lg";
  emotion?: "default" | "determined" | "sad" | "joyful" | "neutral";
  variant?: "character" | "ball" | "bat";
  className?: string;
}

const sizeClasses: Record<string, string> = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
};

const textSizes: Record<string, string> = {
  sm: "text-[9px]",
  md: "text-xs",
  lg: "text-sm",
};

export function TeamBadge({ teamId, size = "md", emotion = "default", variant = "character", className = "" }: TeamBadgeProps) {
  const team = TEAM_COLORS[teamId];
  const [imgFailed, setImgFailed] = useState(false);
  if (!team) return null;

  const imgSrc = variant === "ball"
    ? `/team-ball/${teamId}.png`
    : variant === "bat"
    ? `/team-bat/${teamId}.png`
    : `${config.baseUrl}team-characters/${teamId}_${emotion}.png`;

  const bgColor = useMemo(() => {
    const hex = team.primary.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, 0.35)`;
  }, [team.primary]);

  const isIcon = variant === "ball" || variant === "bat";

  return (
    <div
      className={`${sizeClasses[size]} flex items-center justify-center flex-shrink-0 ${isIcon ? "" : "rounded-full overflow-hidden"} ${className}`}
      style={isIcon ? undefined : { backgroundColor: bgColor }}
    >
      {imgFailed ? (
        <span
          className={`${textSizes[size]} font-bold`}
          style={{ color: team.secondary }}
        >
          {team.shortName}
        </span>
      ) : (
        <img
          src={imgSrc}
          alt={team.shortName}
          className={variant === "bat" ? "w-8 h-6 object-contain" : isIcon ? "w-6 h-6 object-contain" : "w-full h-full object-cover"}
          onError={() => setImgFailed(true)}
        />
      )}
    </div>
  );
}
