"use client";

import { BrandKitForm } from "@/components/brand/BrandKitForm";
import { PaletteManager } from "@/components/brand/PaletteManager";
import { useDashboard } from "@/components/dashboard/DashboardContext";

export default function MarcaPage() {
  const { userId, kit, profile, logoDataUrl, refresh } = useDashboard();
  return (
    <div>
      <h1 className="text-2xl font-bold">Kit de marca</h1>
      <p className="mb-6 mt-1 text-[#4A154B]/70">Tus colores, logo y tono de voz. Todo lo que generes los usará.</p>
      <BrandKitForm
        variant="full"
        userId={userId}
        initialKit={kit}
        initialBusinessName={profile?.business_name ?? ""}
        initialLogoUrl={logoDataUrl}
        onSaved={refresh}
      />
      <PaletteManager />
    </div>
  );
}
