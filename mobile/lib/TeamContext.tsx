import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { getMyTeam, setMyTeam as setMyTeamInDb } from "@/lib/db";

interface TeamContextValue {
  myTeam: string | null;
  setMyTeam: (team: string | null) => void;
}

const TeamContext = createContext<TeamContextValue | null>(null);

export function TeamProvider({ children }: { children: ReactNode }) {
  const [myTeam, setMyTeamState] = useState<string | null>(null);

  useEffect(() => {
    getMyTeam().then(setMyTeamState);
  }, []);

  const setMyTeam = useCallback((team: string | null) => {
    setMyTeamState(team);
    if (team) setMyTeamInDb(team);
  }, []);

  return (
    <TeamContext.Provider value={{ myTeam, setMyTeam }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam(): TeamContextValue {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error("useTeam must be used within TeamProvider");
  return ctx;
}
