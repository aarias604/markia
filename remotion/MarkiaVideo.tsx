// Video explicativo animado de Markia (1080x1920, 30 fps) con 6 estilos:
//   pop · pizarra · neón · minimal · cuaderno · retro
// Cada escena muestra una ilustración según lo que dice la voz: varios íconos animados
// o, si el cliente lo activa, una imagen generada con IA.
import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import {
  AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig,
} from "remotion";
import { loadFont as loadArchivo } from "@remotion/google-fonts/ArchivoBlack";
import { loadFont as loadBungee } from "@remotion/google-fonts/Bungee";
import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadKalam } from "@remotion/google-fonts/Kalam";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadSpace } from "@remotion/google-fonts/SpaceGrotesk";
import { ICONS } from "../lib/icons";
import { FPS, VOICE_START, itemTimes } from "../lib/video-timing";
import type { Scene, VideoStyle } from "../lib/video";
import type { Colors, VideoProps } from "./types";

const F = {
  archivo: loadArchivo().fontFamily,
  bungee: loadBungee().fontFamily,
  caveat: loadCaveat("normal", { weights: ["700"], subsets: ["latin"] }).fontFamily,
  inter: loadInter("normal", { weights: ["400", "600", "800"], subsets: ["latin"] }).fontFamily,
  kalam: loadKalam("normal", { weights: ["400", "700"], subsets: ["latin"] }).fontFamily,
  playfair: loadPlayfair("normal", { weights: ["700"], subsets: ["latin"] }).fontFamily,
  playfairItalic: loadPlayfair("italic", { weights: ["700"], subsets: ["latin"] }).fontFamily,
  space: loadSpace("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily,
};

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}
const alpha = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}`;

function usePop(delay: number, damping = 12) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, stiffness: 170, mass: 0.7 } });
}

// ---------------------------------------------------------------------
// Temas
// ---------------------------------------------------------------------
type Enter = "slide" | "wipe" | "blur" | "fade" | "flip" | "bounce";
type Accent = "box" | "marker" | "glow" | "italic" | "scribble" | "shadow3d";

interface Theme {
  id: VideoStyle;
  c: Colors;
  head: string;
  body: string;
  upper: boolean;
  headScale: number;
  tracking: number;
  bg: (i: number) => string;
  ink: string;
  soft: string;
  accent: string;
  onAccent: string;
  accentStyle: Accent;
  card: CSSProperties;
  enter: Enter;
  mascot: boolean;
  caption: { bg: string; ink: string; activeBg: string; activeInk: string; border: string; font: string };
}

function makeTheme(style: VideoStyle, c: Colors): Theme {
  const base = { c, accent: c.color_accent, onAccent: c.color_cream };
  switch (style) {
    case "pizarra": {
      const ink = mix("#1E2230", c.color_primary, 0.35);
      return {
        ...base, id: style, head: F.kalam, body: F.kalam, upper: false, headScale: 1.05, tracking: 0,
        bg: () => "#FBFBF7", ink, soft: c.color_secondary, accentStyle: "marker", enter: "wipe", mascot: false,
        card: { background: "transparent", border: `6px solid ${ink}`, borderRadius: "255px 18px 225px 18px / 18px 225px 18px 255px", padding: 48 },
        caption: { bg: "#FFFFFF", ink, activeBg: alpha(c.color_accent, 0.55), activeInk: ink, border: `4px solid ${ink}`, font: F.kalam },
      };
    }
    case "neon": {
      const dark = mix("#07060D", c.color_primary, 0.25);
      return {
        ...base, id: style, head: F.space, body: F.space, upper: true, headScale: 0.95, tracking: 1,
        bg: (i) => (i % 2 ? mix(dark, c.color_secondary, 0.12) : dark), ink: "#F4F2FF", soft: c.color_secondary,
        onAccent: dark, accentStyle: "glow", enter: "blur", mascot: false,
        card: { background: alpha("#FFFFFF", 0.05), border: `3px solid ${c.color_accent}`, borderRadius: 28, boxShadow: `0 0 40px ${alpha(c.color_accent, 0.55)}, inset 0 0 30px ${alpha(c.color_accent, 0.15)}`, padding: 48 },
        caption: { bg: alpha("#000000", 0.6), ink: "#F4F2FF", activeBg: "transparent", activeInk: c.color_accent, border: `3px solid ${alpha(c.color_accent, 0.8)}`, font: F.space },
      };
    }
    case "minimal":
      return {
        ...base, id: style, head: F.playfair, body: F.inter, upper: false, headScale: 0.95, tracking: -1,
        bg: (i) => (i % 2 ? mix(c.color_cream, "#FFFFFF", 0.6) : c.color_cream), ink: c.color_primary, soft: mix(c.color_primary, c.color_cream, 0.55),
        accentStyle: "italic", enter: "fade", mascot: false,
        card: { background: "#FFFFFF", borderRadius: 36, boxShadow: "0 24px 70px rgba(0,0,0,.08)", padding: 52 },
        caption: { bg: alpha("#FFFFFF", 0.9), ink: c.color_primary, activeBg: "transparent", activeInk: c.color_accent, border: "none", font: F.inter },
      };
    case "cuaderno": {
      const ink = mix("#1D2B6B", c.color_primary, 0.4);
      return {
        ...base, id: style, head: F.caveat, body: F.kalam, upper: false, headScale: 1.25, tracking: 0,
        bg: () => "#FFFDF4", ink, soft: c.color_secondary, accentStyle: "scribble", enter: "flip", mascot: true,
        card: { background: mix("#FFF59D", c.color_accent, 0.2), borderRadius: 6, boxShadow: "6px 10px 18px rgba(0,0,0,.15)", padding: 48, transform: "rotate(-1.5deg)" },
        caption: { bg: mix("#FFF59D", c.color_accent, 0.15), ink, activeBg: alpha(c.color_accent, 0.35), activeInk: ink, border: "none", font: F.kalam },
      };
    }
    case "retro": {
      const ink = mix("#151515", c.color_primary, 0.3);
      return {
        ...base, id: style, head: F.bungee, body: F.inter, upper: true, headScale: 0.82, tracking: 0,
        bg: (i) => (i % 2 ? mix(c.color_cream, c.color_accent, 0.22) : mix(c.color_cream, c.color_secondary, 0.22)), ink, soft: c.color_secondary,
        accentStyle: "shadow3d", enter: "bounce", mascot: true,
        card: { background: "#FFFFFF", border: `8px solid ${ink}`, borderRadius: 0, boxShadow: `18px 18px 0 ${c.color_secondary}`, padding: 48 },
        caption: { bg: c.color_accent, ink: c.color_cream, activeBg: ink, activeInk: c.color_cream, border: `5px solid ${ink}`, font: F.inter },
      };
    }
    default:
      return {
        ...base, id: "pop", head: F.archivo, body: F.inter, upper: true, headScale: 1, tracking: -2,
        bg: (i) => (i % 2 ? mix(c.color_cream, c.color_accent, 0.12) : c.color_cream), ink: c.color_primary, soft: c.color_secondary,
        accentStyle: "box", enter: "slide", mascot: true,
        card: { background: "#FFFFFF", border: `5px solid ${c.color_primary}`, borderRadius: 28, boxShadow: `14px 14px 0 ${c.color_primary}`, padding: 44 },
        caption: { bg: alpha("#FFFFFF", 0.92), ink: c.color_primary, activeBg: c.color_accent, activeInk: c.color_cream, border: `4px solid ${c.color_primary}`, font: F.inter },
      };
  }
}

const ThemeCtx = createContext<Theme | null>(null);
const useT = () => useContext(ThemeCtx)!;

// ---------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------
function Pop({ delay = 0, children, style, from = 0.6 }: { delay?: number; children: ReactNode; style?: CSSProperties; from?: number }) {
  const s = usePop(delay);
  return (
    <div style={{ ...style, opacity: Math.min(s * 1.4, 1), transform: `${style?.transform ?? ""} translateY(${(1 - s) * 40}px) scale(${from + (1 - from) * s})` }}>
      {children}
    </div>
  );
}

/** Titular: entra palabra por palabra; las últimas palabras van resaltadas según el estilo. */
function Headline({ text, delay = 4, size, align = "left" }: { text: string; delay?: number; size?: number; align?: "left" | "center" }) {
  const t = useT();
  const frame = useCurrentFrame();
  const raw = text.split(/\s+/).filter(Boolean);
  const words = t.upper ? raw.map((w) => w.toUpperCase()) : raw;
  const len = text.length;
  const fs = (size ?? (len > 42 ? 92 : len > 28 ? 112 : len > 16 ? 132 : 150)) * t.headScale;
  const accentFrom = words.length >= 3 ? words.length - Math.ceil(words.length / 3) : words.length >= 2 ? words.length - 1 : 99;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: `${fs * 0.08}px ${fs * 0.22}px`, justifyContent: align === "center" ? "center" : "flex-start", lineHeight: t.id === "minimal" ? 1.05 : 0.98 }}>
      {words.map((w, i) => {
        const accent = i >= accentFrom;
        const d = delay + i * 4;
        const base: CSSProperties = { fontFamily: t.head, fontSize: fs, letterSpacing: t.tracking, color: t.ink, display: "inline-block", position: "relative" };
        let style = base;
        let extra: ReactNode = null;
        if (accent) {
          switch (t.accentStyle) {
            case "box":
              style = { ...base, color: t.onAccent, background: t.accent, padding: `0 ${fs * 0.12}px`, transform: "rotate(-2deg)" };
              break;
            case "marker": {
              const p = interpolate(frame, [d + 6, d + 18], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              extra = <span style={{ position: "absolute", left: -8, right: -8, bottom: fs * 0.08, height: fs * 0.42, background: alpha(t.accent, 0.5), transform: "skewX(-8deg)", clipPath: `inset(0 ${100 - p}% 0 0)`, zIndex: -1 }} />;
              break;
            }
            case "glow":
              style = { ...base, color: t.accent, textShadow: `0 0 12px ${t.accent}, 0 0 36px ${t.accent}, 0 0 70px ${alpha(t.accent, 0.6)}` };
              break;
            case "italic":
              style = { ...base, fontFamily: F.playfairItalic, fontStyle: "italic", color: t.accent };
              break;
            case "scribble": {
              const p = interpolate(frame, [d + 6, d + 20], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              style = { ...base, color: t.c.color_accent };
              extra = (
                <svg viewBox="0 0 100 12" preserveAspectRatio="none" style={{ position: "absolute", left: 0, right: 0, bottom: -fs * 0.12, width: "100%", height: fs * 0.22 }}>
                  <path d="M2 8 Q 15 2 28 7 T 54 7 T 80 6 T 98 5" fill="none" stroke={t.c.color_accent} strokeWidth="3" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={p} />
                </svg>
              );
              break;
            }
            case "shadow3d":
              style = { ...base, color: t.c.color_cream, WebkitTextStroke: `${fs * 0.03}px ${t.ink}`, textShadow: `${fs * 0.05}px ${fs * 0.05}px 0 ${t.accent}, ${fs * 0.1}px ${fs * 0.1}px 0 ${t.ink}` };
              break;
          }
        }
        return (
          <Pop key={i} delay={d} from={t.id === "minimal" ? 0.95 : 0.6}>
            <span style={style}>{extra}{w}</span>
          </Pop>
        );
      })}
    </div>
  );
}

function Body({ text, delay = 18, align = "left", size = 56 }: { text?: string; delay?: number; align?: "left" | "center"; size?: number }) {
  const t = useT();
  if (!text) return null;
  return (
    <Pop delay={delay} from={0.95}>
      <p style={{ fontFamily: t.body, fontWeight: 600, fontSize: size * (t.body === F.kalam ? 1.08 : 1), lineHeight: 1.3, color: t.ink, opacity: 0.85, margin: 0, textAlign: align }}>{text}</p>
    </Pop>
  );
}

function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const t = useT();
  return (
    <div style={{ position: "relative", ...t.card, ...style }}>
      {t.id === "cuaderno" && <div style={{ position: "absolute", top: -22, left: "40%", width: 160, height: 44, background: alpha("#FFFFFF", 0.6), transform: "rotate(-4deg)", boxShadow: "0 2px 6px rgba(0,0,0,.1)" }} />}
      {children}
    </div>
  );
}

/** Mascota original de Markia: un bloque con ojos que parpadea y se balancea. */
function Mascot({ size = 180, delay = 10, wave = false }: { size?: number; delay?: number; wave?: boolean }) {
  const t = useT();
  const frame = useCurrentFrame();
  const s = usePop(delay, 9);
  if (!t.mascot) return null;
  const line = t.ink;
  const bob = Math.sin(frame / 9) * 8;
  const blink = frame % 90 > 84 ? 0.1 : 1;
  const tilt = wave ? Math.sin(frame / 5) * 8 : Math.sin(frame / 14) * 3;
  const eye = (x: number) => (
    <div style={{ position: "absolute", left: x * size, top: size * 0.3, width: size * 0.24, height: size * 0.24 * blink, background: "#fff", borderRadius: "50%", border: `${size * 0.035}px solid ${line}`, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: "38%", top: "30%", width: "40%", height: "45%", background: line, borderRadius: "50%" }} />
    </div>
  );
  return (
    <div style={{ width: size, height: size * 1.05, transform: `translateY(${bob + (1 - s) * 200}px) rotate(${tilt}deg) scale(${s})`, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, bottom: size * 0.12, background: t.accent, borderRadius: t.id === "retro" ? 0 : size * 0.22, border: `${size * 0.04}px solid ${line}` }} />
      {eye(0.2)}
      {eye(0.56)}
      <div style={{ position: "absolute", left: size * 0.4, top: size * 0.64, width: size * 0.2, height: size * 0.07, borderRadius: 99, background: line }} />
      {[0.22, 0.42, 0.62].map((x) => (
        <div key={x} style={{ position: "absolute", left: x * size, bottom: 0, width: size * 0.12, height: size * 0.16, background: t.accent, border: `${size * 0.03}px solid ${line}`, borderTop: "none", borderRadius: `0 0 ${size * 0.05}px ${size * 0.05}px` }} />
      ))}
    </div>
  );
}

/** Insignia de un ícono con el estilo del tema. */
function Badge({ name, size, delay }: { name: string; size: number; delay: number }) {
  const t = useT();
  const frame = useCurrentFrame();
  const s = usePop(delay, 9);
  const Icon = ICONS[name] ?? ICONS.idea;
  const wobble = Math.sin((frame + delay * 7) / 13) * 3;
  const common: CSSProperties = { width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${s}) rotate(${(1 - s) * -20 + wobble}deg)` };
  let shell: CSSProperties;
  let color = t.c.color_cream;
  switch (t.id) {
    case "pizarra":
      shell = { border: `6px solid ${t.ink}`, borderRadius: "50% 45% 52% 48% / 48% 52% 45% 50%", background: alpha(t.accent, 0.25) };
      color = t.ink;
      break;
    case "neon":
      shell = { border: `4px solid ${t.accent}`, borderRadius: "50%", boxShadow: `0 0 30px ${t.accent}, inset 0 0 24px ${alpha(t.accent, 0.4)}` };
      color = t.accent;
      break;
    case "minimal":
      shell = { border: `2px solid ${alpha(t.ink, 0.25)}`, borderRadius: "50%", background: "#FFFFFF" };
      color = t.ink;
      break;
    case "cuaderno":
      shell = { background: mix("#FFF59D", t.accent, 0.25), boxShadow: "5px 8px 14px rgba(0,0,0,.15)", transform: `${common.transform} rotate(-4deg)` };
      color = t.ink;
      break;
    case "retro":
      shell = { background: t.accent, border: `7px solid ${t.ink}`, boxShadow: `12px 12px 0 ${t.ink}`, borderRadius: 0 };
      break;
    default:
      shell = { background: t.accent, border: `6px solid ${t.ink}`, borderRadius: size * 0.28, boxShadow: `14px 14px 0 ${t.ink}` };
  }
  return (
    <div style={{ ...common, ...shell }}>
      <Icon width={size * 0.56} height={size * 0.56} color={color} strokeWidth={t.id === "minimal" ? 1.4 : 2} />
    </div>
  );
}

/** Ilustración de la escena: varios íconos según la frase, o una imagen hecha con IA. */
function Visual({ s, size = 620, delay = 12 }: { s: Scene; size?: number; delay?: number }) {
  const t = useT();
  const frame = useCurrentFrame();
  if (s.imageUrl) {
    const sp = usePopStatic(frame, delay);
    const zoom = interpolate(frame, [0, 300], [1, 1.1], { extrapolateRight: "clamp" });
    const frameStyle: CSSProperties =
      t.id === "neon" ? { border: `4px solid ${t.accent}`, boxShadow: `0 0 50px ${alpha(t.accent, 0.6)}`, borderRadius: 32 }
      : t.id === "minimal" ? { borderRadius: 40, boxShadow: "0 30px 80px rgba(0,0,0,.12)" }
      : t.id === "cuaderno" ? { border: "22px solid #FFFFFF", borderBottomWidth: 80, boxShadow: "8px 14px 26px rgba(0,0,0,.2)", transform: "rotate(-2.5deg)" }
      : t.id === "pizarra" ? { border: `7px solid ${t.ink}`, borderRadius: "30px 8px 26px 10px / 10px 26px 8px 30px" }
      : t.id === "retro" ? { border: `9px solid ${t.ink}`, boxShadow: `20px 20px 0 ${t.accent}` }
      : { border: `6px solid ${t.ink}`, borderRadius: 32, boxShadow: `16px 16px 0 ${t.ink}` };
    return (
      <div style={{ width: size, height: size, overflow: "hidden", alignSelf: "center", opacity: sp, transform: `scale(${0.85 + 0.15 * sp}) ${frameStyle.transform ?? ""}`, ...frameStyle }}>
        <Img src={s.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})` }} />
      </div>
    );
  }
  const icons = (s.ilustracion?.length ? s.ilustracion : [s.icono]).slice(0, 4);
  const [main, ...rest] = icons;
  const R = size * 0.38;
  const angles = rest.length === 1 ? [-35] : rest.length === 2 ? [-40, 40] : [-60, 0, 60];
  return (
    <div style={{ position: "relative", width: size, height: size * 0.82, alignSelf: "center" }}>
      {rest.map((_, k) => {
        const a = ((angles[k] - 90) * Math.PI) / 180;
        const x = size / 2 + Math.cos(a) * R * 1.15;
        const y = size * 0.46 + Math.sin(a) * R * 0.9 + R * 0.2;
        const p = interpolate(frame, [delay + 14 + k * 8, delay + 26 + k * 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <svg key={`l${k}`} style={{ position: "absolute", inset: 0 }} width={size} height={size * 0.82}>
            <line x1={size / 2} y1={size * 0.5} x2={x} y2={y} stroke={alpha(t.id === "neon" ? t.accent : t.ink, 0.45)} strokeWidth={5}
              strokeDasharray="14 12" pathLength={1} strokeDashoffset={p} />
          </svg>
        );
      })}
      <div style={{ position: "absolute", left: size / 2 - size * 0.24, top: size * 0.5 - size * 0.24 }}>
        <Badge name={main} size={size * 0.48} delay={delay} />
      </div>
      {rest.map((n, k) => {
        const a = ((angles[k] - 90) * Math.PI) / 180;
        const x = size / 2 + Math.cos(a) * R * 1.15;
        const y = size * 0.46 + Math.sin(a) * R * 0.9 + R * 0.2;
        const float = Math.sin((frame + k * 20) / 15) * 10;
        return (
          <div key={n + k} style={{ position: "absolute", left: x - size * 0.13, top: y - size * 0.13 + float }}>
            <Badge name={n} size={size * 0.26} delay={delay + 18 + k * 8} />
          </div>
        );
      })}
    </div>
  );
}
function usePopStatic(frame: number, delay: number) {
  return spring({ frame: frame - delay, fps: FPS, config: { damping: 14 } });
}

// ---------------------------------------------------------------------
// Fondo, entrada de escena y etiqueta de paso según el tema
// ---------------------------------------------------------------------
function Background({ index }: { index: number }) {
  const t = useT();
  const frame = useCurrentFrame();
  const bg = t.bg(index);
  switch (t.id) {
    case "pizarra":
      return (
        <AbsoluteFill style={{ background: bg }}>
          <AbsoluteFill style={{ backgroundImage: `linear-gradient(${alpha(t.ink, 0.05)} 2px, transparent 2px), linear-gradient(90deg, ${alpha(t.ink, 0.05)} 2px, transparent 2px)`, backgroundSize: "60px 60px" }} />
          <svg style={{ position: "absolute", right: 60, bottom: 330 }} width="260" height="120" viewBox="0 0 260 120">
            <path d="M10 90 C 70 20, 150 120, 240 40" fill="none" stroke={alpha(t.accent, 0.8)} strokeWidth="8" strokeLinecap="round"
              pathLength={1} strokeDasharray="1" strokeDashoffset={interpolate(frame, [10, 40], [1, 0], { extrapolateRight: "clamp" })} />
            <path d="M215 30 L242 40 L228 65" fill="none" stroke={alpha(t.accent, 0.8)} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity={frame > 38 ? 1 : 0} />
          </svg>
        </AbsoluteFill>
      );
    case "neon": {
      const shift = (frame * 3) % 120;
      return (
        <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: -200, top: 200, width: 700, height: 700, borderRadius: "50%", background: alpha(t.c.color_secondary, 0.35), filter: "blur(120px)" }} />
          <div style={{ position: "absolute", right: -200, top: 900, width: 600, height: 600, borderRadius: "50%", background: alpha(t.accent, 0.3), filter: "blur(120px)" }} />
          <div style={{ position: "absolute", left: -540, right: -540, bottom: -200, height: 900, transform: "perspective(600px) rotateX(62deg)", transformOrigin: "bottom",
            backgroundImage: `linear-gradient(${alpha(t.accent, 0.5)} 3px, transparent 3px), linear-gradient(90deg, ${alpha(t.accent, 0.5)} 3px, transparent 3px)`,
            backgroundSize: "120px 120px", backgroundPosition: `0 ${shift}px`, opacity: 0.35 }} />
        </AbsoluteFill>
      );
    }
    case "minimal":
      return (
        <AbsoluteFill style={{ background: bg }}>
          <div style={{ position: "absolute", left: 90, top: 190, width: interpolate(frame, [0, 30], [0, 140], { extrapolateRight: "clamp" }), height: 3, background: t.accent }} />
          <div style={{ position: "absolute", right: -160, bottom: -160, width: 520, height: 520, borderRadius: "50%", border: `2px solid ${alpha(t.ink, 0.12)}` }} />
        </AbsoluteFill>
      );
    case "cuaderno":
      return (
        <AbsoluteFill style={{ background: bg }}>
          <AbsoluteFill style={{ backgroundImage: `linear-gradient(transparent 62px, ${alpha("#7FA6D9", 0.45)} 62px, ${alpha("#7FA6D9", 0.45)} 64px)`, backgroundSize: "100% 64px", backgroundPosition: "0 20px" }} />
          <div style={{ position: "absolute", left: 120, top: 0, bottom: 0, width: 3, background: alpha("#E5484D", 0.6) }} />
          {[0, 1, 2, 3, 4, 5].map((k) => <div key={k} style={{ position: "absolute", left: 40, top: 250 + k * 280, width: 34, height: 34, borderRadius: "50%", background: "#E9E4D4", boxShadow: "inset 2px 2px 4px rgba(0,0,0,.15)" }} />)}
        </AbsoluteFill>
      );
    case "retro": {
      const spin = frame * 1.2;
      const star = (x: number, y: number, r: number, fill: string, rot: number) => {
        const pts = Array.from({ length: 24 }, (_, k) => {
          const rr = k % 2 ? r * 0.62 : r;
          const a = (k * Math.PI) / 12;
          return `${x + Math.cos(a) * rr},${y + Math.sin(a) * rr}`;
        }).join(" ");
        return <polygon points={pts} fill={fill} stroke={t.ink} strokeWidth="6" transform={`rotate(${rot} ${x} ${y})`} />;
      };
      return (
        <AbsoluteFill style={{ background: bg }}>
          <AbsoluteFill style={{ backgroundImage: `radial-gradient(${alpha(t.ink, 0.13)} 5px, transparent 6px)`, backgroundSize: "40px 40px" }} />
          <div style={{ position: "absolute", left: -100, right: -100, top: 1560, height: 90, background: `repeating-linear-gradient(45deg, ${t.accent} 0 40px, ${t.c.color_secondary} 40px 80px)`, borderTop: `7px solid ${t.ink}`, borderBottom: `7px solid ${t.ink}`, transform: "rotate(-4deg)" }} />
          <svg style={{ position: "absolute", inset: 0 }} width="1080" height="1920">
            {star(960, 330, 90, t.accent, spin)}
            {star(110, 1380, 60, t.c.color_secondary, -spin)}
          </svg>
        </AbsoluteFill>
      );
    }
    default:
      return (
        <AbsoluteFill style={{ background: bg }}>
          <AbsoluteFill style={{ backgroundImage: `radial-gradient(${mix(bg, t.ink, 0.14)} 2.5px, transparent 2.5px)`, backgroundSize: "44px 44px" }} />
          <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.10) 100%)" }} />
        </AbsoluteFill>
      );
  }
}

function Shell({ index, count, brandName, children }: { index: number; count: number; brandName: string; children: ReactNode }) {
  const t = useT();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = interpolate(frame, [0, t.enter === "fade" ? 20 : 12], [0, 1], { extrapolateRight: "clamp" });
  const b = spring({ frame, fps, config: { damping: 9, stiffness: 140 } });
  const enterStyle: CSSProperties =
    t.enter === "wipe" ? { clipPath: `inset(0 ${(1 - e) * 100}% 0 0)` }
    : t.enter === "blur" ? { opacity: e, filter: `blur(${(1 - e) * 14}px)`, transform: `scale(${1.08 - 0.08 * e})` }
    : t.enter === "fade" ? { opacity: e, transform: `translateY(${(1 - e) * 30}px)` }
    : t.enter === "flip" ? { opacity: e, transform: `perspective(1600px) rotateY(${(1 - e) * -28}deg)`, transformOrigin: "left center" }
    : t.enter === "bounce" ? { transform: `scale(${0.8 + 0.2 * b}) rotate(${(1 - b) * -4}deg)` }
    : { opacity: e, transform: `translateX(${(1 - e) * 60}px)` };
  const showStep = index > 0 && index < count - 1;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Background index={index} />
      <div style={{ position: "absolute", left: 90, top: 110, fontFamily: t.body, fontWeight: 800, fontSize: 30, letterSpacing: 4, color: t.ink, opacity: 0.55 }}>
        {brandName.toUpperCase().slice(0, 28)}
      </div>
      {showStep && t.id !== "minimal" && (
        <div style={{ position: "absolute", right: 90, top: 100, display: "flex", alignItems: "flex-end", gap: 8 }}>
          {Array.from({ length: Math.min(count - 2, 8) }).map((_, i) => (
            <div key={i} style={{ width: 22, height: 26 + i * 9, borderRadius: t.id === "retro" ? 0 : 4, border: `4px solid ${t.id === "neon" ? t.accent : t.ink}`, background: i < index ? t.accent : "transparent", boxShadow: t.id === "neon" && i < index ? `0 0 12px ${t.accent}` : undefined }} />
          ))}
        </div>
      )}
      {showStep && t.id === "minimal" && (
        <div style={{ position: "absolute", right: 90, top: 100, fontFamily: t.body, fontSize: 30, color: t.ink, opacity: 0.6 }}>
          {String(index).padStart(2, "0")} / {String(count - 2).padStart(2, "0")}
        </div>
      )}
      <AbsoluteFill style={enterStyle}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
}

function StepTag({ n, delay = 0 }: { n: number; delay?: number }) {
  const t = useT();
  const style: CSSProperties =
    t.id === "neon" ? { color: t.accent, border: `3px solid ${t.accent}`, boxShadow: `0 0 18px ${alpha(t.accent, 0.7)}`, borderRadius: 12 }
    : t.id === "minimal" ? { color: t.accent, borderBottom: `3px solid ${t.accent}` }
    : t.id === "pizarra" || t.id === "cuaderno" ? { color: t.ink, border: `4px solid ${t.ink}`, borderRadius: "18px 6px 16px 8px", transform: "rotate(-3deg)" }
    : t.id === "retro" ? { background: t.ink, color: t.c.color_cream, boxShadow: `8px 8px 0 ${t.accent}` }
    : { background: t.ink, color: t.c.color_cream, borderRadius: 14, transform: "rotate(-3deg)" };
  return (
    <Pop delay={delay}>
      <span style={{ display: "inline-block", fontFamily: t.head, fontSize: t.id === "cuaderno" ? 56 : 40, padding: t.id === "minimal" ? "0 0 6px" : "8px 22px", ...style }}>
        {t.id === "minimal" ? `Paso ${n}` : "PASO "}{t.id !== "minimal" && <span style={{ color: t.accent }}>{n}</span>}
      </span>
    </Pop>
  );
}

// ---------------------------------------------------------------------
// Escenas
// ---------------------------------------------------------------------
const CENTER: CSSProperties = { padding: "200px 90px 430px", justifyContent: "center" };

function Portada({ s }: { s: Scene }) {
  const t = useT();
  return (
    <AbsoluteFill style={{ ...CENTER, gap: 40 }}>
      <Headline text={s.titulo} />
      {s.texto && (
        <Pop delay={22} style={{ alignSelf: "flex-start", transform: "rotate(-3deg)" }}>
          <div style={{ border: t.id === "minimal" ? "none" : `4px solid ${t.id === "neon" ? t.accent : t.ink}`, background: t.id === "neon" ? "transparent" : "#fff", borderRadius: 14, padding: "14px 26px", fontFamily: t.body, fontWeight: 600, fontStyle: "italic", fontSize: 44, color: t.ink }}>
            {s.texto}
          </div>
        </Pop>
      )}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <Visual s={s} size={560} delay={26} />
        <Mascot size={170} delay={40} />
      </div>
    </AbsoluteFill>
  );
}

function Ilustracion({ s }: { s: Scene }) {
  return (
    <AbsoluteFill style={{ ...CENTER, gap: 44 }}>
      <Visual s={s} size={720} delay={6} />
      <Headline text={s.titulo} delay={14} align="center" size={110} />
      <Body text={s.texto} delay={26} align="center" />
    </AbsoluteFill>
  );
}

function Icono({ s, index }: { s: Scene; index: number }) {
  return (
    <AbsoluteFill style={{ ...CENTER, gap: 46 }}>
      <StepTag n={index} />
      <Headline text={s.titulo} delay={6} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Visual s={s} size={520} delay={16} />
        <Mascot size={170} delay={30} />
      </div>
      <Body text={s.texto} delay={26} />
    </AbsoluteFill>
  );
}

function Lista({ s, index, length }: { s: Scene; index: number; length: number }) {
  const t = useT();
  const frame = useCurrentFrame();
  const items = (s.puntos ?? []).filter(Boolean);
  const times = itemTimes(items.length, length);
  const icons = s.ilustracion?.length ? s.ilustracion : [];
  return (
    <AbsoluteFill style={{ ...CENTER, gap: 50 }}>
      <StepTag n={index} />
      <Headline text={s.titulo} delay={6} />
      <Pop delay={14} from={0.9}>
        <Card style={{ display: "flex", flexDirection: "column", gap: 46 }}>
          {items.map((it, k) => {
            const at = times[k] * FPS;
            const shown = spring({ frame: frame - at, fps: FPS, config: { damping: 13 } });
            const check = interpolate(frame, [at + 6, at + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const Icon = icons[k] ? ICONS[icons[k]] : null;
            const boxColor = t.id === "neon" ? t.accent : t.ink;
            return (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 28, opacity: 0.25 + shown * 0.75, transform: `translateX(${(1 - shown) * 30}px)` }}>
                <div style={{ width: 88, height: 88, flexShrink: 0, borderRadius: t.id === "retro" ? 0 : 18, border: `5px solid ${boxColor}`, background: check > 0 ? t.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: t.id === "neon" && check > 0 ? `0 0 20px ${t.accent}` : undefined }}>
                  {Icon && check < 0.5 ? (
                    <Icon width={50} height={50} color={boxColor} strokeWidth={2} />
                  ) : (
                    <svg width="58" height="58" viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke={t.id === "neon" ? "#07060D" : t.c.color_cream} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="30" strokeDashoffset={30 * (1 - check)} /></svg>
                  )}
                </div>
                <span style={{ fontFamily: t.body, fontWeight: 800, fontSize: t.body === F.kalam ? 66 : 62, color: t.ink, lineHeight: 1.15 }}>{it}</span>
              </div>
            );
          })}
        </Card>
      </Pop>
      <div style={{ alignSelf: "flex-end", marginTop: -10, marginRight: 40 }}><Mascot size={190} delay={24} /></div>
    </AbsoluteFill>
  );
}

function Dato({ s, index }: { s: Scene; index: number }) {
  const t = useT();
  const frame = useCurrentFrame();
  const raw = s.dato ?? "";
  const m = raw.match(/^(\D*)(\d+(?:[.,]\d+)?)(.*)$/);
  const p = interpolate(frame, [10, 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 3) });
  let shown = raw;
  if (m) {
    const target = Number(m[2].replace(",", "."));
    const dec = m[2].includes(".") || m[2].includes(",") ? 1 : 0;
    shown = `${m[1]}${(target * p).toFixed(dec)}${m[3]}`;
  }
  const bar = spring({ frame: frame - 30, fps: FPS, config: { damping: 14 } });
  const numStyle: CSSProperties =
    t.id === "neon" ? { color: t.accent, textShadow: `0 0 20px ${t.accent}, 0 0 60px ${t.accent}` }
    : t.id === "minimal" ? { color: t.accent, fontFamily: F.playfair }
    : t.id === "pizarra" || t.id === "cuaderno" ? { color: t.accent }
    : { color: t.accent, WebkitTextStroke: `6px ${t.ink}`, textShadow: `12px 12px 0 ${t.ink}` };
  return (
    <AbsoluteFill style={{ ...CENTER, gap: 40 }}>
      <StepTag n={index} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Pop delay={4}>
          <div style={{ fontFamily: t.head, fontSize: raw.length > 5 ? 220 : 300, lineHeight: 1, ...numStyle }}>{shown}</div>
        </Pop>
        {(s.ilustracion?.length || s.imageUrl) && <Visual s={{ ...s, ilustracion: s.ilustracion?.slice(0, 1) }} size={300} delay={20} />}
      </div>
      <div style={{ height: 18, width: 700 * bar, background: t.id === "neon" ? t.accent : t.ink, borderRadius: 9 }} />
      <Headline text={s.titulo} delay={20} size={100} />
      <Body text={s.texto} delay={34} />
    </AbsoluteFill>
  );
}

function Comparacion({ s }: { s: Scene }) {
  const t = useT();
  const frame = useCurrentFrame();
  const side = (k: 0 | 1) => {
    const d = k === 0 ? s.izquierda : s.derecha;
    const sp = spring({ frame: frame - 14 - k * 16, fps: FPS, config: { damping: 13 } });
    const Icon = k === 0 ? ICONS.no : ICONS.check;
    const good = k === 1;
    const bg = t.id === "neon" ? "transparent" : good ? t.accent : mix(t.bg(0), t.c.color_secondary, 0.3);
    const ink = t.id === "neon" ? (good ? t.accent : t.ink) : good ? t.onAccent : t.ink;
    return (
      <div style={{ flex: 1, transform: `translateX(${(1 - sp) * (k === 0 ? -500 : 500)}px) rotate(${k === 0 ? -2 : 2}deg)` }}>
        <Card style={{ background: bg, minHeight: 760, display: "flex", flexDirection: "column", alignItems: "center", gap: 30, textAlign: "center", borderColor: t.id === "neon" ? (good ? t.accent : alpha(t.ink, 0.5)) : undefined }}>
          <div style={{ width: 120, height: 120, borderRadius: 60, background: t.id === "neon" ? "transparent" : "#fff", border: `5px solid ${ink}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon width={74} height={74} color={ink} strokeWidth={3} />
          </div>
          <div style={{ fontFamily: t.head, fontSize: 54 * t.headScale, color: ink, lineHeight: 1 }}>{t.upper ? (d?.titulo ?? "").toUpperCase() : d?.titulo}</div>
          <div style={{ fontFamily: t.body, fontWeight: 600, fontSize: 40, color: ink, lineHeight: 1.3 }}>{d?.texto}</div>
        </Card>
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ padding: "200px 70px 430px", justifyContent: "center", gap: 60 }}>
      <Headline text={s.titulo} align="center" size={100} />
      <div style={{ display: "flex", gap: 40 }}>{side(0)}{side(1)}</div>
    </AbsoluteFill>
  );
}

function Cierre({ s, brandName, handle, logoUrl, length }: { s: Scene; brandName: string; handle: string; logoUrl: string | null; length: number }) {
  const t = useT();
  const frame = useCurrentFrame();
  const at = Math.min(length * FPS * 0.55, 75);
  const following = frame > at;
  const press = following ? spring({ frame: frame - at, fps: FPS, config: { damping: 10 } }) : 0;
  const line = t.id === "neon" ? t.accent : t.ink;
  return (
    <AbsoluteFill style={{ ...CENTER, gap: 50 }}>
      <Headline text={s.titulo || `Sigue a ${brandName}`} />
      <Pop delay={18}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, background: t.id === "neon" ? alpha("#000000", 0.4) : "#fff", border: `5px solid ${line}`, borderRadius: t.id === "retro" ? 0 : 999, padding: "18px 22px", boxShadow: t.id === "neon" ? `0 0 30px ${alpha(t.accent, 0.6)}` : t.id === "minimal" ? "0 20px 60px rgba(0,0,0,.1)" : `10px 10px 0 ${line}`, width: "fit-content" }}>
          <div style={{ width: 96, height: 96, borderRadius: 48, overflow: "hidden", background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", border: `4px solid ${line}` }}>
            {logoUrl ? <Img src={logoUrl} style={{ width: "86%", height: "86%", objectFit: "contain", background: "#fff", borderRadius: 40 }} />
              : <span style={{ fontFamily: t.head, fontSize: 52, color: t.onAccent }}>{brandName.charAt(0).toUpperCase()}</span>}
          </div>
          <span style={{ fontFamily: t.body, fontWeight: 800, fontSize: 44, color: t.id === "neon" ? t.ink : t.ink }}>@{handle}</span>
          <span style={{
            fontFamily: t.body, fontWeight: 800, fontSize: 36, padding: "12px 28px", borderRadius: t.id === "retro" ? 0 : 14,
            background: following ? "transparent" : t.accent, color: following ? t.ink : t.onAccent,
            border: `4px solid ${line}`, transform: `scale(${1 + Math.sin(press * Math.PI) * 0.15})`,
          }}>{following ? "Siguiendo" : "Seguir"}</span>
        </div>
      </Pop>
      <Body text={s.texto} delay={28} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        {(s.ilustracion?.length || s.imageUrl) ? <Visual s={s} size={420} delay={30} /> : <span />}
        <Mascot size={240} delay={20} wave />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------
// Subtítulos tipo karaoke
// ---------------------------------------------------------------------
function Captions({ words }: { words: VideoProps["words"] }) {
  const t = useT();
  const frame = useCurrentFrame();
  const now = frame / FPS;
  const groups: VideoProps["words"][] = [];
  for (const w of words) {
    const g = groups[groups.length - 1];
    if (g && g.length < 4 && !/[.!?;:]$/.test(g[g.length - 1].text)) g.push(w);
    else groups.push([w]);
  }
  const group = groups.find((g, i) => now >= g[0].start - 0.05 && now < (groups[i + 1]?.[0].start ?? g[g.length - 1].end + 0.4));
  if (!group) return null;
  const cs = t.caption;
  return (
    <div style={{ position: "absolute", left: 60, right: 60, bottom: 250, display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px 16px", background: cs.bg, border: cs.border, borderRadius: t.id === "retro" ? 0 : 24, padding: "18px 28px", maxWidth: 940, boxShadow: t.id === "neon" ? `0 0 24px ${alpha(t.accent, 0.5)}` : undefined }}>
        {group.map((w, i) => {
          const active = now >= w.start && now < w.end + 0.08;
          return (
            <span key={i} style={{
              fontFamily: cs.font, fontWeight: 800, fontSize: cs.font === F.kalam ? 60 : 54,
              color: active ? cs.activeInk : cs.ink, background: active ? cs.activeBg : "transparent", borderRadius: 10, padding: "0 10px",
              transform: active ? "scale(1.06)" : undefined, display: "inline-block",
              textShadow: active && t.id === "neon" ? `0 0 14px ${t.accent}` : undefined,
            }}>{w.text}</span>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Composición
// ---------------------------------------------------------------------
export function MarkiaVideo(p: VideoProps) {
  const theme = makeTheme(p.style ?? "pop", p.colors);
  const f = (sec: number) => Math.round(sec * FPS);
  const total = f(p.total);
  return (
    <ThemeCtx.Provider value={theme}>
      <AbsoluteFill style={{ background: theme.bg(0) }}>
        {p.scenes.map((s, i) => {
          const tm = p.timings[i];
          if (!tm) return null;
          return (
            <Sequence key={i} from={f(tm.start)} durationInFrames={Math.max(f(tm.length), 1)} name={`Escena ${i + 1}`}>
              <Shell index={i} count={p.scenes.length} brandName={p.brandName}>
                {s.layout === "portada" && <Portada s={s} />}
                {s.layout === "ilustracion" && <Ilustracion s={s} />}
                {s.layout === "icono" && <Icono s={s} index={i} />}
                {s.layout === "lista" && <Lista s={s} index={i} length={tm.length} />}
                {s.layout === "dato" && <Dato s={s} index={i} />}
                {s.layout === "comparacion" && <Comparacion s={s} />}
                {s.layout === "cierre" && <Cierre s={s} brandName={p.brandName} handle={p.handle} logoUrl={p.logoUrl} length={tm.length} />}
              </Shell>
              {p.sfx && s.sfx && s.sfx !== "none" && i > 0 && (
                <Sequence durationInFrames={f(1.5)}><Audio src={p.sfx[s.sfx]} volume={0.35} /></Sequence>
              )}
              {p.sfx && s.layout === "lista" &&
                itemTimes((s.puntos ?? []).filter(Boolean).length, tm.length).map((at, k) => (
                  <Sequence key={k} from={f(at + 0.2)} durationInFrames={f(0.6)}><Audio src={p.sfx!.pop} volume={0.3} /></Sequence>
                ))}
            </Sequence>
          );
        })}
        {p.subtitles && p.words.length > 0 && <Captions words={p.words} />}
        {p.voiceUrl && <Sequence from={f(VOICE_START)}><Audio src={p.voiceUrl} /></Sequence>}
        {p.musicUrl && (
          <Audio src={p.musicUrl} loop
            volume={(fr) => interpolate(fr, [0, 20, total - 40, total], [0, 0.1, 0.1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
        )}
      </AbsoluteFill>
    </ThemeCtx.Provider>
  );
}
