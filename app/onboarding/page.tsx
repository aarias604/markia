"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandKitForm } from "@/components/brand/BrandKitForm";
import { FullScreenLoader } from "@/components/ui/Loader";
import { MarkiaLogo } from "@/components/ui/MarkiaLogo";
import { blobToDataUrl } from "@/lib/download";
import { createClient } from "@/lib/supabase/client";
import type { BrandKit } from "@/lib/types";

interface Loaded {
  userId: string;
  kit: BrandKit | null;
  businessName: string;
  logoUrl: string | null;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const [{ data: profile }, { data: kit }] = await Promise.all([
        supabase.from("profiles").select("business_name").eq("id", user.id).maybeSingle(),
        supabase.from("brand_kits").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      let logoUrl: string | null = null;
      if (kit?.logo_path) {
        const { data: blob } = await supabase.storage.from("brand-assets").download(kit.logo_path);
        if (blob) logoUrl = await blobToDataUrl(blob);
      }
      setData({
        userId: user.id,
        kit: (kit as BrandKit | null) ?? null,
        businessName: profile?.business_name ?? "",
        logoUrl,
      });
    })();
  }, [router]);

  if (!data) return <FullScreenLoader />;

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <MarkiaLogo />
        <h1 className="mt-8 text-2xl font-bold sm:text-3xl">Configura tu kit de marca</h1>
        <p className="mb-8 mt-1 text-[#4A154B]/70">
          Cuatro pasos rápidos. Podrás cambiar todo después desde «Kit de marca».
        </p>
        <BrandKitForm
          variant="wizard"
          userId={data.userId}
          initialKit={data.kit}
          initialBusinessName={data.businessName}
          initialLogoUrl={data.logoUrl}
          onSaved={() => {
            router.replace("/dashboard");
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
