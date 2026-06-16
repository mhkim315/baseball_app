import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { getMyTeam, setMyTeam as setMyTeamInDb } from "@/lib/db";
import AsyncStorage from "@react-native-async-storage/async-storage";

const WIDGET_TEAM_KEY = "@fullcount_widget_team";

interface TeamContextValue {
  myTeam: string | null;
  setMyTeam: (team: string | null) => void;
  loading: boolean;
}

const TeamContext = createContext<TeamContextValue | null>(null);

export function TeamProvider({ children }: { children: ReactNode }) {
  const [myTeam, setMyTeamState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      setMyTeamState(getMyTeam());
    } catch (e) {
      console.warn("TeamContext: getMyTeam failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const setMyTeam = useCallback((team: string | null) => {
    setMyTeamState(team);
    if (team) {
      setMyTeamInDb(team);
      AsyncStorage.setItem(WIDGET_TEAM_KEY, team).catch(() => {});
    } else {
      AsyncStorage.removeItem(WIDGET_TEAM_KEY).catch(() => {});
    }
  }, []);

  return (
    <TeamContext.Provider value={{ myTeam, setMyTeam, loading }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam(): TeamContextValue {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error("useTeam must be used within TeamProvider");
  return ctx;
}
