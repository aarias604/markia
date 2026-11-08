"use client";

// Portadas para historias destacadas de Instagram (incluidas en todos los planes).
import { useRef, useState } from "react";
import { Download, Loader2, Star } from "lucide-react";
import { PaletteSelect } from "@/components/brand/PaletteSelect";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { DEFAULT_KIT } from "@/lib/brand";
import { downloadBlob, slugify, svgToPngBlob, wait } from "@/lib/download";
import { ICONS } from "@/lib/icons";
import { pickColors } from "@/lib/palettes";
import type { BrandColors } from "@/lib/templates";
import { btnGold, btnSecondary, cardCls, errorCls, labelCls } from "@/lib/ui";

const COVERS: { id: string; label: string; icon: string }[] = [
  { id: "ubicacion", label: "Ubicación", icon: "ubicacion" },
  { id: "menu", label: "Menú", icon: "menu" },
  { id: "contacto", label: "Contacto", icon: "telefono" },
  { id: "info", label: "Info", icon: "info" },
  { id: "horario", label: "Horario", icon: "reloj" },
  { id: "promos", label: "Promos", icon: "porcentaje" },
  { id: "resenas", label: "Reseñas", icon: "estrella" },
  { id: "envios", label: "Envíos", icon: "envio" },
  { id: "pagos", label: "Pagos", icon: "tarjeta" },
  { id: "nosotros", label: "Nosotros", icon: "equipo" },
  { id: "productos", label: "Productos", icon: "compras" },
  { id: "servicios", label: "Servicios", icon: "trabajo" },
  { id: "preguntas", label: "Preguntas", icon: "mensaje" },
  { id: "novedades", label: "Novedades", icon: "brillo" },
  { id: "eventos", label: "Eventos", icon: "calendario" },
  { id: "regalos", label: "Regalos", icon: "regalo" },
  { id: "clientes", label: "Clientes", icon: "corazon" },
  { id: "tips", label: "Tips", icon: "idea" },
  { id: "pedidos", label: "Pedidos", icon: "paquete" },
  { id: "tienda", label: "Tienda", icon: "tienda" },
  { id: "logros", label: "Logros", icon: "trofeo" },
  { id: "fotos", label: "Galería", icon: "camara" },
  { id: "correo", label: "Correo", icon: "correo" },
  { id: "cafe", label: "Café", icon: "cafe" },
];

type Style = "solido" | "circulo" | "degradado" | "linea";
type Role = keyof BrandColors;
const ROLES: { key: Role; label: string }[] = [
  { key: "color_primary", label: "Principal" },
  { key: "color_secondary", label: "Secundario" },
  { key: "color_accent", label: "Acento" },
  { key: "color_cream", label: "Claro" },
];
const STYLES: { id: Style; label: string }[] = [
  { id: "solido", label: "Sólido" },
  { id: "circulo", label: "Círculo" },
  { id: "degradado", label: "Degradado" },
  { id: "linea", label: "Línea" },
];

const W = 1080;
const H = 1920;

function Cover({
  icon, label, style, bg, fg, colors, showText, ref,
}: {
  icon: string; label: string; style: Style; bg: string; fg: string; colors: BrandColors; showText: boolean;
  ref?: React.Ref<SVGSVGElement>;
}) {
  const Icon = ICONS[icon] ?? ICONS.estrella;
  const cy = showText ? 900 : 960;
  const gid = `g-${label}`;
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={bg} />
          <stop offset="1" stopColor={bg === colors.color_secondary ? colors.color_primary : colors.color_secondary} />
        </linearGradient>
      </defs>
      {style === "degradado" ? <rect width={W} height={H} fill={`url(#${gid})`} /> : (
        <rect width={W} height={H} fill={style === "solido" ? bg : colors.color_cream === fg ? colors.color_primary : colors.color_cream} />
      )}
      {style === "circulo" && <circle cx={W / 2} cy={cy} r={330} fill={bg} />}
      {style === "linea" && <circle cx={W / 2} cy={cy} r={330} fill="none" stroke={bg} strokeWidth={26} />}
      <Icon x={W / 2 - 190} y={cy - 190} width={380} height={380} color={fg} strokeWidth={1.6} />
      {showText && (
        <text x={W / 2} y={cy + 470} textAnchor="middle" fill={style === "solido" || style === "degradado" ? fg : bg}
          fontFamily="Arial, Helvetica, sans-serif" fontWeight={700} fontSize={110} letterSpacing={4}>
          {label.toUpperCase()}
        </text>
      )}
    </svg>
  );
}

export default function DestacadasPage() {
  const { kit } = useDashboard();
  const [paletteId, setPaletteId] = useState("kit");
  const [colors, setColors] = useState<BrandColors>(pickColors(kit ?? DEFAULT_KIT));
  const [style, setStyle] = useState<Style>("circulo");
  const [bgRole, setBgRole] = useState<Role>("color_primary");
  const [fgRole, setFgRole] = useState<Role>("color_cream");
  const [showText, setShowText] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refs = useRef<Record<string, SVGSVGElement | null>>({});

  const bg = colors[bgRole];
  const fg = colors[fgRole];

  async function download(id: string, label: string) {
    const el = refs.current[id];
    if (!el) return;
    const blob = await svgToPngBlob(el, W, H);
    downloadBlob(blob, `destacada-${slugify(label)}.png`);
  }

  async function downloadAll() {
    setBusy("all");
    setError(null);
    try {
      for (const c of COVERS) {
        await download(c.id, c.label);
        await wait(350);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo descargar.");
    } finally {
      setBusy(null);
    }
  }

  const chip = (role: Role, current: Role, set: (r: Role) => void) => (
    <button key={role} type="button" onClick={() => set(role)} title={ROLES.find((r) => r.key === role)?.label}
      className={`h-9 w-9 rounded-full ring-offset-2 ${current === role ? "ring-2 ring-[#4A154B]" : "ring-1 ring-black/10"}`}
      style={{ background: colors[role] }} />
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Star className="h-6 w-6 text-[#8C338A]" /> Portadas de destacadas</h1>
        <p className="mt-1 text-[#4A154B]/70">
          Incluidas en tu plan. Descárgalas y súbelas como historia; al crear la destacada elige la imagen como portada.
        </p>
      </div>

      <div className={`${cardCls} space-y-5`}>
        <PaletteSelect value={paletteId} onChange={(id, c) => { setPaletteId(id); setColors(c); }} />
        <div className="flex flex-wrap gap-6">
          <div>
            <label className={labelCls}>Estilo</label>
            <div className="flex flex-wrap gap-1 rounded-full bg-[#4A154B]/5 p-1 text-sm font-semibold">
              {STYLES.map((s) => (
                <button key={s.id} type="button" onClick={() => setStyle(s.id)}
                  className={`rounded-full px-3 py-1.5 ${style === s.id ? "bg-white shadow" : "text-[#4A154B]/60"}`}>{s.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>{style === "linea" ? "Color del círculo" : "Color de fondo"}</label>
            <div className="flex gap-2">{ROLES.map((r) => chip(r.key, bgRole, setBgRole))}</div>
          </div>
          <div>
            <label className={labelCls}>Color del ícono</label>
            <div className="flex gap-2">{ROLES.map((r) => chip(r.key, fgRole, setFgRole))}</div>
          </div>
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[#4A154B]" checked={showText} onChange={(e) => setShowText(e.target.checked)} />
            Mostrar el nombre
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className={btnGold} onClick={downloadAll} disabled={busy === "all"}>
            {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Descargar todas ({COVERS.length})
          </button>
          {error && <p className={errorCls}>{error}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {COVERS.map((c) => (
          <div key={c.id} className="space-y-2">
            <div className="relative aspect-[9/16] overflow-hidden rounded-2xl shadow">
              <Cover ref={(el) => { refs.current[c.id] = el; }} icon={c.icon} label={c.label} style={style}
                bg={bg} fg={fg} colors={colors} showText={showText} />
              {/* Vista de cómo se ve en el círculo de Instagram */}
              <div className="pointer-events-none absolute bottom-2 right-2 h-14 w-14 overflow-hidden rounded-full border-2 border-white shadow">
                <div className="h-full w-full" style={{ transform: "scale(1.9)", transformOrigin: "center" }}>
                  <Cover icon={c.icon} label={c.label} style={style} bg={bg} fg={fg} colors={colors} showText={false} />
                </div>
              </div>
            </div>
            <button className={`${btnSecondary} w-full`} onClick={() => download(c.id, c.label)}>
              <Download className="h-4 w-4" /> {c.label}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
