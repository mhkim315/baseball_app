import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { getMyTeam, setMyTeam as setMyTeamInDb } from "@/lib/db";

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
    if (team) setMyTeamInDb(team);
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
