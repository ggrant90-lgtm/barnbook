"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface BusinessProSession {
  userName: string;
  userInitials: string;
  userRole: string;
}

const Ctx = createContext<BusinessProSession | null>(null);

export function BusinessProSessionProvider({
  session,
  children,
}: {
  session: BusinessProSession;
  children: ReactNode;
}) {
  return <Ctx.Provider value={session}>{children}</Ctx.Provider>;
}

export function useBusinessProSession(): BusinessProSession {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return { userName: "Member", userInitials: "U", userRole: "Business Pro" };
  }
  return ctx;
}
