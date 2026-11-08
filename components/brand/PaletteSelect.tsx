"use client";

// Selector de paleta antes de generar: la del kit de marca o una guardada.
import Link from "next/link";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { DEFAULT_KIT } from "@/lib/brand";
import { pickColors, usePalettes } from "@/lib/palettes";
import type { BrandColors } from "@/lib/templates";
import { labelCls } from "@/lib/ui";

export function Swatches({ c, size = "h-5 w-5" }: { c: BrandColors; size?: string }) {
  return (
    <span className="inline-flex overflow-hidden rounded-md ring-1 ring-black/10">
      {[c.color_primary, c.color_secondary, c.color_accent, c.color_cream].map((x, i) => (
        <span key={i} className={size} style={{ background: x }} />
      ))}
    </span>
  );
}

export function PaletteSelect({
  value,
  onChange,
  label = "Paleta de colores",
}: {
  value: string; // "kit" o id de la paleta
  onChange: (id: string, colors: BrandColors) => void;
  label?: string;
}) {
  const { kit } = useDashboard();
  const { palettes } = usePalettes();
  const kitColors = pickColors(kit ?? DEFAULT_KIT);
  const options = [{ id: "kit", name: "Paleta del kit de marca", colors: kitColors }, ...(palettes ?? []).map((p) => ({ id: p.id, name: p.name, colors: pickColors(p) }))];

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.id} type="button" onClick={() => onChange(o.id, o.colors)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
              value === o.id ? "border-[#4A154B] bg-white shadow" : "border-[#4A154B]/15 bg-white/60 hover:border-[#4A154B]/40"
            }`}>
            <Swatches c={o.colors} size="h-4 w-4" /> {o.name}
          </button>
        ))}
        <Link href="/dashboard/marca#paletas" className="self-center text-xs font-semibold text-[#6B21A8] underline">+ Nueva paleta</Link>
      </div>
    </div>
  );
}
