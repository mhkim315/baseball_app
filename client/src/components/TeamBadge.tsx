import { useState } from "react";
import { TEAM_COLORS } from "@/lib/teamColors";
import { config } from "@/lib/config";

interface TeamBadgeProps {
  teamId: string;
  size?: "sm" | "md" | "lg";
  emotion?: "default" | "determined" | "sad" | "joyful";
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

export function TeamBadge({ teamId, size = "md", emotion = "default", className = "" }: TeamBadgeProps) {
  const team = TEAM_COLORS[teamId];
  const [imgFailed, setImgFailed] = useState(false);
  if (!team) return null;

  const imgSrc = `${config.baseUrl}team-characters/${teamId}_${emotion}.png`;

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${className}`}
      style={{ backgroundColor: team.primary }}
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
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      )}
    </div>
  );
}
