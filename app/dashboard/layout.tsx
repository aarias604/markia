"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { DashboardProvider } from "@/components/dashboard/DashboardContext";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { FullScreenLoader } from "@/components/ui/Loader";

// El dashboard se dibuja solo en el navegador (usa fechas y datos del usuario).
const subscribe = () => () => {};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  if (!isClient) return <FullScreenLoader />;

  return (
    <DashboardProvider>
      <DashboardShell>{children}</DashboardShell>
    </DashboardProvider>
  );
}
