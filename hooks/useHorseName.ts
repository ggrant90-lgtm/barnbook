"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

export function useHorseName(horseId: string) {
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!horseId) {
      setName(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from("horses")
        .select("name")
        .eq("id", horseId)
        .single();

      if (cancelled) return;
      if (error || !data) setName(null);
      else setName(data.name);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [horseId]);

  return { name, loading };
}
