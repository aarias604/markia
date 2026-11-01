// Logotipo provisional de Markia (texto + monograma). Reemplázalo cuando tengas tu logo final.
export function MarkiaLogo({ light = false, className = "" }: { light?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-lg font-black ${
          light ? "bg-[#D9B382] text-[#4A154B]" : "bg-[#4A154B] text-[#D9B382]"
        }`}
        aria-hidden
      >
        M
      </span>
      <span className={`text-xl font-bold tracking-tight ${light ? "text-[#FAF5EF]" : "text-[#4A154B]"}`}>
        Markia
      </span>
    </span>
  );
}
