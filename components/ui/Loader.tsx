import { Loader2 } from "lucide-react";

export function FullScreenLoader({ text = "Cargando…" }: { text?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF5EF] text-[#4A154B]">
      <span className="inline-flex items-center gap-3 text-sm font-medium">
        <Loader2 className="h-5 w-5 animate-spin" /> {text}
      </span>
    </div>
  );
}

export function InlineLoader({ text = "Cargando…" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-[#4A154B]/70">
      <Loader2 className="h-4 w-4 animate-spin" /> {text}
    </span>
  );
}
