// Video explicativo animado de Markia (1080x1920, 30 fps).
// Estilo: fondo claro con puntos, titulares grandes en dos colores que entran palabra por palabra,
// tarjetas con sombra sólida, listas que se marcan, contadores, mascota y subtítulos tipo karaoke.
import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig,
} from "remotion";
import { loadFont as loadArchivo } from "@remotion/google-fonts/ArchivoBlack";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { ICONS } from "../lib/icons";
import { FPS, VOICE_START, itemTimes } from "../lib/video-timing";
import type { Scene } from "../lib/video";
import type { Colors, VideoProps } from "./types";

const { fontFamily: HEAD } = loadArchivo();
const { fontFamily: BODY } = loadInter("normal", { weights: ["400", "600", "800"], subsets: ["latin"] });

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

function usePop(delay: number, damping = 12) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, stiffness: 170, mass: 0.7 } });
}

function Pop({ delay = 0, children, style, from = 0.6 }: { delay?: number; children: ReactNode; style?: CSSProperties; from?: number }) {
  const s = usePop(delay);
  return (
    <div style={{ ...style, opacity: Math.min(s * 1.4, 1), transform: `${style?.transform ?? ""} translateY(${(1 - s) * 40}px) scale(${from + (1 - from) * s})` }}>
      {children}
    </div>
  );
}

/** Titular grande: entra palabra por palabra; las últimas palabras van resaltadas. */
function Headline({ text, c, delay = 4, size, align = "left" }: { text: string; c: Colors; delay?: number; size?: number; align?: "left" | "center" }) {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const len = text.length;
  const fs = size ?? (len > 42 ? 92 : len > 28 ? 112 : len > 16 ? 132 : 150);
  const accentFrom = words.length >= 3 ? words.length - Math.ceil(words.length / 3) : words.length >= 2 ? words.length - 1 : 99;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: `${fs * 0.08}px ${fs * 0.22}px`, justifyContent: align === "center" ? "center" : "flex-start", lineHeight: 0.95 }}>
      {words.map((w, i) => {
        const accent = i >= accentFrom;
        return (
          <Pop key={i} delay={delay + i * 4}>
            <span style={{
              fontFamily: HEAD, fontSize: fs, letterSpacing: -2,
              color: accent ? c.color_cream : c.color_primary,
              background: accent ? c.color_accent : "transparent",
              padding: accent ? `0 ${fs * 0.12}px` : 0,
              display: "inline-block", transform: accent ? "rotate(-2deg)" : undefined,
            }}>{w}</span>
          </Pop>
        );
      })}
    </div>
  );
}

function Card({ c, children, style }: { c: Colors; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: "#FFFFFF", border: `5px solid ${c.color_primary}`, borderRadius: 28,
      boxShadow: `14px 14px 0 ${c.color_primary}`, padding: 44, ...style,
    }}>{children}</div>
  );
}

/** Mascota original de Markia: un bloque con ojos que parpadea y se balancea. */
function Mascot({ c, size = 180, delay = 10, wave = false }: { c: Colors; size?: number; delay?: number; wave?: boolean }) {
  const frame = useCurrentFrame();
  const s = usePop(delay, 9);
  const bob = Math.sin(frame / 9) * 8;
  const blink = frame % 90 > 84 ? 0.1 : 1;
  const tilt = wave ? Math.sin(frame / 5) * 8 : Math.sin(frame / 14) * 3;
  const eye = (x: number) => (
    <div style={{ position: "absolute", left: x * size, top: size * 0.3, width: size * 0.24, height: size * 0.24 * blink, background: "#fff", borderRadius: "50%", border: `${size * 0.035}px solid ${c.color_primary}`, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: "38%", top: "30%", width: "40%", height: "45%", background: c.color_primary, borderRadius: "50%" }} />
    </div>
  );
  return (
    <div style={{ width: size, height: size * 1.05, transform: `translateY(${bob + (1 - s) * 200}px) rotate(${tilt}deg) scale(${s})`, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, bottom: size * 0.12, background: c.color_accent, borderRadius: size * 0.22, border: `${size * 0.04}px solid ${c.color_primary}` }} />
      {eye(0.2)}
      {eye(0.56)}
      <div style={{ position: "absolute", left: size * 0.4, top: size * 0.64, width: size * 0.2, height: size * 0.07, borderRadius: 99, background: c.color_primary }} />
      {[0.22, 0.42, 0.62].map((x) => (
        <div key={x} style={{ position: "absolute", left: x * size, bottom: 0, width: size * 0.12, height: size * 0.16, background: c.color_accent, border: `${size * 0.03}px solid ${c.color_primary}`, borderTop: "none", borderRadius: `0 0 ${size * 0.05}px ${size * 0.05}px` }} />
      ))}
      <div style={{ position: "absolute", left: size * 0.1, right: size * 0.1, bottom: -size * 0.1, height: size * 0.06, background: "rgba(0,0,0,.12)", borderRadius: "50%", filter: "blur(4px)" }} />
    </div>
  );
}

function IconBadge({ name, c, size = 300, delay = 6 }: { name: string; c: Colors; size?: number; delay?: number }) {
  const Icon = ICONS[name] ?? ICONS.idea;
  const frame = useCurrentFrame();
  const s = usePop(delay, 8);
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, background: c.color_accent, border: `6px solid ${c.color_primary}`,
      boxShadow: `14px 14px 0 ${c.color_primary}`, display: "flex", alignItems: "center", justifyContent: "center",
      transform: `scale(${s}) rotate(${(1 - s) * -25 + Math.sin(frame / 12) * 2}deg)`,
    }}>
      <Icon width={size * 0.58} height={size * 0.58} color={c.color_cream} strokeWidth={2} />
    </div>
  );
}

function Body({ text, c, delay = 18, align = "left" }: { text?: string; c: Colors; delay?: number; align?: "left" | "center" }) {
  if (!text) return null;
  return (
    <Pop delay={delay} from={0.95}>
      <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: 56, lineHeight: 1.3, color: c.color_primary, opacity: 0.85, margin: 0, textAlign: align }}>{text}</p>
    </Pop>
  );
}

// ---------------------------------------------------------------------
// Escenas
// ---------------------------------------------------------------------
function Shell({ c, index, count, brandName, children }: { c: Colors; index: number; count: number; brandName: string; children: ReactNode }) {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const bg = index % 2 === 0 ? c.color_cream : mix(c.color_cream, c.color_accent, 0.12);
  const showStep = index > 0 && index < count - 1;
  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${mix(bg, c.color_primary, 0.14)} 2.5px, transparent 2.5px)`, backgroundSize: "44px 44px" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.10) 100%)" }} />
      <div style={{ position: "absolute", left: 90, top: 110, fontFamily: BODY, fontWeight: 800, fontSize: 30, letterSpacing: 4, color: c.color_primary, opacity: 0.55 }}>
        {brandName.toUpperCase().slice(0, 28)}
      </div>
      {showStep && (
        <div style={{ position: "absolute", right: 90, top: 100, display: "flex", alignItems: "flex-end", gap: 8 }}>
          {Array.from({ length: Math.min(count - 2, 8) }).map((_, i) => (
            <div key={i} style={{ width: 22, height: 26 + i * 9, borderRadius: 4, border: `4px solid ${c.color_primary}`, background: i < index ? c.color_accent : "transparent" }} />
          ))}
        </div>
      )}
      <AbsoluteFill style={{ opacity: enter, transform: `translateX(${(1 - enter) * 60}px)` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
}

function StepTag({ n, c, delay = 0 }: { n: number; c: Colors; delay?: number }) {
  return (
    <Pop delay={delay}>
      <span style={{ display: "inline-block", background: c.color_primary, color: c.color_cream, fontFamily: HEAD, fontSize: 40, padding: "8px 22px", borderRadius: 14, transform: "rotate(-3deg)" }}>
        PASO <span style={{ color: c.color_accent }}>{n}</span>
      </span>
    </Pop>
  );
}

function Portada({ s, c }: { s: Scene; c: Colors }) {
  const frame = useCurrentFrame();
  const heights = [120, 200, 300, 420];
  return (
    <AbsoluteFill style={{ padding: "300px 90px 0" }}>
      <Headline text={s.titulo} c={c} />
      {s.texto && (
        <Pop delay={22} style={{ marginTop: 40, alignSelf: "flex-start", transform: "rotate(-4deg)" }}>
          <div style={{ border: `4px solid ${c.color_primary}`, background: "#fff", borderRadius: 14, padding: "14px 26px", fontFamily: BODY, fontWeight: 600, fontStyle: "italic", fontSize: 44, color: c.color_primary }}>
            {s.texto}
          </div>
        </Pop>
      )}
      <div style={{ position: "absolute", left: 90, bottom: 470, display: "flex", alignItems: "flex-end", gap: 22 }}>
        {heights.map((h, i) => {
          const g = spring({ frame: frame - 26 - i * 6, fps: FPS, config: { damping: 11 } });
          const fill = [mix(c.color_cream, c.color_secondary, 0.5), c.color_secondary, mix(c.color_secondary, c.color_accent, 0.6), c.color_accent][i];
          return (
            <div key={i} style={{ width: 150, height: h * g, background: fill, border: `5px solid ${c.color_primary}`, borderRadius: "10px 10px 0 0", display: "flex", justifyContent: "center", paddingTop: 14, fontFamily: HEAD, fontSize: 56, color: c.color_primary, overflow: "hidden" }}>
              {i + 1}
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", right: 100, bottom: 900 }}><Mascot c={c} size={200} delay={40} /></div>
      {Array.from({ length: 10 }).map((_, i) => {
        const y = interpolate(frame, [0, 160], [-50, 1700 + (i % 3) * 40]);
        return <div key={i} style={{ position: "absolute", left: 520 + ((i * 97) % 480), top: y - i * 130, width: 18, height: 18, background: i % 2 ? c.color_accent : c.color_secondary, transform: `rotate(${frame * (i + 2)}deg)`, opacity: 0.7 }} />;
      })}
    </AbsoluteFill>
  );
}

function Icono({ s, c, index }: { s: Scene; c: Colors; index: number }) {
  return (
    <AbsoluteFill style={{ padding: "200px 90px 430px", justifyContent: "center", gap: 56 }}>
      <StepTag n={index} c={c} />
      <Headline text={s.titulo} c={c} delay={6} />
      <div style={{ display: "flex", alignItems: "center", gap: 50, marginTop: 30 }}>
        <IconBadge name={s.icono} c={c} delay={16} size={360} />
        <Mascot c={c} size={200} delay={30} />
      </div>
      <Body text={s.texto} c={c} delay={26} />
    </AbsoluteFill>
  );
}

function Lista({ s, c, index, length }: { s: Scene; c: Colors; index: number; length: number }) {
  const frame = useCurrentFrame();
  const items = (s.puntos ?? []).filter(Boolean);
  const times = itemTimes(items.length, length);
  return (
    <AbsoluteFill style={{ padding: "200px 90px 430px", justifyContent: "center", gap: 50 }}>
      <StepTag n={index} c={c} />
      <Headline text={s.titulo} c={c} delay={6} />
      <Pop delay={14} from={0.9}>
        <Card c={c} style={{ display: "flex", flexDirection: "column", gap: 46, padding: 56 }}>
          {items.map((it, k) => {
            const at = times[k] * FPS;
            const shown = spring({ frame: frame - at, fps: FPS, config: { damping: 13 } });
            const check = interpolate(frame, [at + 6, at + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 28, opacity: 0.25 + shown * 0.75, transform: `translateX(${(1 - shown) * 30}px)` }}>
                <div style={{ width: 88, height: 88, flexShrink: 0, borderRadius: 18, border: `5px solid ${c.color_primary}`, background: check > 0 ? c.color_accent : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="58" height="58" viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke={c.color_cream} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="30" strokeDashoffset={30 * (1 - check)} /></svg>
                </div>
                <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: 62, color: c.color_primary, lineHeight: 1.15 }}>{it}</span>
              </div>
            );
          })}
        </Card>
      </Pop>
      <div style={{ alignSelf: "flex-end", marginTop: -10, marginRight: 40 }}><Mascot c={c} size={190} delay={24} /></div>
    </AbsoluteFill>
  );
}

function Dato({ s, c, index }: { s: Scene; c: Colors; index: number }) {
  const frame = useCurrentFrame();
  const raw = s.dato ?? "";
  const m = raw.match(/^(\D*)(\d+(?:[.,]\d+)?)(.*)$/);
  const p = interpolate(frame, [10, 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (t) => 1 - Math.pow(1 - t, 3) });
  let shown = raw;
  if (m) {
    const target = Number(m[2].replace(",", "."));
    const dec = m[2].includes(".") || m[2].includes(",") ? 1 : 0;
    shown = `${m[1]}${(target * p).toFixed(dec)}${m[3]}`;
  }
  const bar = spring({ frame: frame - 30, fps: FPS, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ padding: "200px 90px 430px", justifyContent: "center", gap: 44 }}>
      <StepTag n={index} c={c} />
      <Pop delay={4}>
        <div style={{ fontFamily: HEAD, fontSize: raw.length > 5 ? 240 : 330, color: c.color_accent, lineHeight: 1, WebkitTextStroke: `6px ${c.color_primary}`, textShadow: `12px 12px 0 ${c.color_primary}` }}>{shown}</div>
      </Pop>
      <div style={{ height: 22, width: 700 * bar, background: c.color_primary, borderRadius: 11 }} />
      <Headline text={s.titulo} c={c} delay={20} size={100} />
      <Body text={s.texto} c={c} delay={34} />
    </AbsoluteFill>
  );
}

function Comparacion({ s, c }: { s: Scene; c: Colors }) {
  const frame = useCurrentFrame();
  const side = (k: 0 | 1) => {
    const d = k === 0 ? s.izquierda : s.derecha;
    const sp = spring({ frame: frame - 14 - k * 16, fps: FPS, config: { damping: 13 } });
    const Icon = k === 0 ? ICONS.no : ICONS.check;
    return (
      <div style={{ flex: 1, transform: `translateX(${(1 - sp) * (k === 0 ? -500 : 500)}px) rotate(${k === 0 ? -2 : 2}deg)` }}>
        <Card c={c} style={{ background: k === 0 ? mix(c.color_cream, c.color_secondary, 0.35) : c.color_accent, minHeight: 760, display: "flex", flexDirection: "column", alignItems: "center", gap: 30, textAlign: "center" }}>
          <div style={{ width: 120, height: 120, borderRadius: 60, background: "#fff", border: `5px solid ${c.color_primary}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon width={74} height={74} color={c.color_primary} strokeWidth={3} />
          </div>
          <div style={{ fontFamily: HEAD, fontSize: 54, color: k === 0 ? c.color_primary : c.color_cream, lineHeight: 1 }}>{(d?.titulo ?? "").toUpperCase()}</div>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 40, color: k === 0 ? c.color_primary : c.color_cream, lineHeight: 1.3 }}>{d?.texto}</div>
        </Card>
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ padding: "200px 70px 430px", justifyContent: "center", gap: 60 }}>
      <Headline text={s.titulo} c={c} align="center" size={100} />
      <div style={{ display: "flex", gap: 40 }}>{side(0)}{side(1)}</div>
    </AbsoluteFill>
  );
}

function Cierre({ s, c, brandName, handle, logoUrl, length }: { s: Scene; c: Colors; brandName: string; handle: string; logoUrl: string | null; length: number }) {
  const frame = useCurrentFrame();
  const following = frame > Math.min(length * FPS * 0.55, 75);
  const press = following ? spring({ frame: frame - Math.min(length * FPS * 0.55, 75), fps: FPS, config: { damping: 10 } }) : 0;
  return (
    <AbsoluteFill style={{ padding: "200px 90px 430px", justifyContent: "center", gap: 50 }}>
      <Headline text={s.titulo || `Sigue a ${brandName}`} c={c} />
      <Pop delay={18}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, background: "#fff", border: `5px solid ${c.color_primary}`, borderRadius: 999, padding: "18px 22px", boxShadow: `10px 10px 0 ${c.color_primary}`, alignSelf: "flex-start", width: "fit-content" }}>
          <div style={{ width: 96, height: 96, borderRadius: 48, overflow: "hidden", background: c.color_accent, display: "flex", alignItems: "center", justifyContent: "center", border: `4px solid ${c.color_primary}` }}>
            {logoUrl ? <Img src={logoUrl} style={{ width: "86%", height: "86%", objectFit: "contain", background: "#fff", borderRadius: 40 }} />
              : <span style={{ fontFamily: HEAD, fontSize: 52, color: c.color_cream }}>{brandName.charAt(0).toUpperCase()}</span>}
          </div>
          <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: 44, color: c.color_primary }}>@{handle}</span>
          <span style={{
            fontFamily: BODY, fontWeight: 800, fontSize: 36, padding: "12px 28px", borderRadius: 14,
            background: following ? "#fff" : c.color_accent, color: following ? c.color_primary : c.color_cream,
            border: `4px solid ${c.color_primary}`, transform: `scale(${1 + Math.sin(press * Math.PI) * 0.15})`,
          }}>{following ? "Siguiendo" : "Seguir"}</span>
        </div>
      </Pop>
      <Body text={s.texto} c={c} delay={28} />
      <div style={{ alignSelf: "flex-end", marginRight: 60 }}><Mascot c={c} size={260} delay={20} wave /></div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------
// Subtítulos tipo karaoke
// ---------------------------------------------------------------------
function Captions({ words, c }: { words: VideoProps["words"]; c: Colors }) {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  // Grupos de hasta 4 palabras (cortan en signos de puntuación).
  const groups: VideoProps["words"][] = [];
  for (const w of words) {
    const g = groups[groups.length - 1];
    if (g && g.length < 4 && !/[.!?;:]$/.test(g[g.length - 1].text)) g.push(w);
    else groups.push([w]);
  }
  const group = groups.find((g, i) => t >= g[0].start - 0.05 && t < (groups[i + 1]?.[0].start ?? g[g.length - 1].end + 0.4));
  if (!group) return null;
  return (
    <div style={{ position: "absolute", left: 60, right: 60, bottom: 250, display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px 16px", background: "rgba(255,255,255,.92)", border: `4px solid ${c.color_primary}`, borderRadius: 24, padding: "18px 28px", maxWidth: 940 }}>
        {group.map((w, i) => {
          const active = t >= w.start && t < w.end + 0.08;
          return (
            <span key={i} style={{
              fontFamily: BODY, fontWeight: 800, fontSize: 54, color: active ? c.color_cream : c.color_primary,
              background: active ? c.color_accent : "transparent", borderRadius: 10, padding: "0 10px",
              transform: active ? "scale(1.06)" : undefined, display: "inline-block",
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
  const c = p.colors;
  const f = (sec: number) => Math.round(sec * FPS);
  const total = f(p.total);
  return (
    <AbsoluteFill style={{ background: c.color_cream }}>
      {p.scenes.map((s, i) => {
        const tm = p.timings[i];
        if (!tm) return null;
        const props = { s, c, index: i };
        return (
          <Sequence key={i} from={f(tm.start)} durationInFrames={Math.max(f(tm.length), 1)} name={`Escena ${i + 1}`}>
            <Shell c={c} index={i} count={p.scenes.length} brandName={p.brandName}>
              {s.layout === "portada" && <Portada {...props} />}
              {s.layout === "icono" && <Icono {...props} />}
              {s.layout === "lista" && <Lista {...props} length={tm.length} />}
              {s.layout === "dato" && <Dato {...props} />}
              {s.layout === "comparacion" && <Comparacion {...props} />}
              {s.layout === "cierre" && <Cierre {...props} brandName={p.brandName} handle={p.handle} logoUrl={p.logoUrl} length={tm.length} />}
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
      {p.subtitles && p.words.length > 0 && <Captions words={p.words} c={c} />}
      {p.voiceUrl && <Sequence from={f(VOICE_START)}><Audio src={p.voiceUrl} /></Sequence>}
      {p.musicUrl && (
        <Audio src={p.musicUrl} loop
          volume={(fr) => interpolate(fr, [0, 20, total - 40, total], [0, 0.1, 0.1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      )}
    </AbsoluteFill>
  );
}
