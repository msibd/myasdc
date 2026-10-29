"use client";

import { useQuery } from "@tanstack/react-query";

export const centreSettingsQueryKey = ["centre-settings"] as const;

export function useCentreName() {
  return useQuery({
    queryKey: centreSettingsQueryKey,
    queryFn: async () => {
      const response = await fetch("/api/centre-settings", { cache: "no-store" });
      if (!response.ok) throw new Error("Centre name could not be loaded.");
      return response.json() as Promise<{ name: string; loginTitle: string }>;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
