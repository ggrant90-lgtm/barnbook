"use client";

import { CURRENT_BARN_ID } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type BarnHorseListItem = {
  id: string;
  name: string;
  breed: string | null;
  color: string | null;
  foal_date: string | null;
  photo_url: string | null;
};

type BarnContextValue = {
  barnName: string | null;
  barnLoading: boolean;
  horses: BarnHorseListItem[];
  horsesLoading: boolean;
  refreshHorses: () => Promise<void>;
};

const BarnContext = createContext<BarnContextValue | null>(null);

export function BarnProvider({ children }: { children: React.ReactNode }) {
  const [barnName, setBarnName] = useState<string | null>(null);
  const [barnLoading, setBarnLoading] = useState(true);
  const [horses, setHorses] = useState<BarnHorseListItem[]>([]);
  const [horsesLoading, setHorsesLoading] = useState(true);

  const refreshHorses = useCallback(async () => {
    setHorsesLoading(true);
    const { data, error } = await supabase
      .from("horses")
      .select("id, name, breed, color, foal_date, photo_url")
      .eq("barn_id", CURRENT_BARN_ID)
      .order("name", { ascending: true });

    if (!error && data) {
      setHorses(data as BarnHorseListItem[]);
    } else {
      setHorses([]);
    }
    setHorsesLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("barns")
        .select("name")
        .eq("id", CURRENT_BARN_ID)
        .single();

      if (cancelled) return;
      if (!error && data?.name) {
        setBarnName(data.name as string);
      } else {
        setBarnName("Barn");
      }
      setBarnLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    refreshHorses();
  }, [refreshHorses]);

  const value = useMemo(
    () => ({
      barnName,
      barnLoading,
      horses,
      horsesLoading,
      refreshHorses,
    }),
    [barnName, barnLoading, horses, horsesLoading, refreshHorses],
  );

  return (
    <BarnContext.Provider value={value}>{children}</BarnContext.Provider>
  );
}

export function useBarn() {
  const ctx = useContext(BarnContext);
  if (!ctx) {
    throw new Error("useBarn must be used within BarnProvider");
  }
  return ctx;
}
