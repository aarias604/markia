// Logotipo de Markia: monograma «M» con destello + nombre. El mismo ícono se usa en la pestaña del navegador (app/icon.svg).
export function MarkiaMark({ light = false, size = 36 }: { light?: boolean; size?: number }) {
  const bg = light ? "#D9B382" : "#4A154B";
  const fg = light ? "#4A154B" : "#D9B382";
  const spark = light ? "#4A154B" : "#FAF5EF";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <rect width="64" height="64" rx="15" fill={bg} />
      <path d="M12 50V20h7.5L29 33.5 38.5 20H46v30h-7.5V32.5L29 45.5 19.5 32.5V50z" fill={fg} />
      <path d="M51.5 7l1.9 4.6 4.6 1.9-4.6 1.9-1.9 4.6-1.9-4.6-4.6-1.9 4.6-1.9z" fill={spark} />
    </svg>
  );
}

export function MarkiaLogo({ light = false, className = "" }: { light?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <MarkiaMark light={light} />
      <span className={`text-xl font-bold tracking-tight ${light ? "text-[#FAF5EF]" : "text-[#4A154B]"}`}>Markia</span>
    </span>
  );
}
