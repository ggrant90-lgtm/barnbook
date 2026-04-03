"use client";

import { DesktopSidebar, MobileSidebarDrawer } from "@/components/Sidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { fullNav, reducedNav } from "@/components/nav-config";
import { TopNav } from "@/components/TopNav";
import { ToastProvider } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function ProtectedChrome({
  children,
  displayName,
  email,
  avatarUrl,
  barnName,
  hasBarn,
}: {
  children: React.ReactNode;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  barnName: string | null;
  hasBarn: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navItems = hasBarn ? fullNav : reducedNav;

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }, [router]);

  return (
    <ToastProvider>
      <div className="flex min-h-full flex-col md:flex-row">
        <DesktopSidebar
          navItems={navItems}
          pathname={pathname}
          barnName={barnName}
          hasBarn={hasBarn}
        />
        <MobileSidebarDrawer
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          navItems={navItems}
          pathname={pathname}
          barnName={barnName}
          hasBarn={hasBarn}
        />

        <div className="flex min-h-full min-w-0 flex-1 flex-col">
          <TopNav
            displayName={displayName}
            email={email}
            avatarUrl={avatarUrl}
            barnName={barnName}
            hasBarn={hasBarn}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            onOpenMobileSidebar={() => setMobileOpen(true)}
            onSignOut={signOut}
          />

          <main className="flex-1 bg-parchment pb-20 text-barn-dark md:pb-6">{children}</main>

          <MobileBottomNav navItems={navItems} pathname={pathname} />
        </div>
      </div>
    </ToastProvider>
  );
}
