// Tiempos de escenas y palabras del video (cliente y servidor, sin dependencias).
import type { Scene } from "./video";

export interface Word {
  text: string;
  start: number; // segundos desde el inicio del video
  end: number;
}
export interface Timing {
  start: number;
  length: number;
}
export interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export const VOICE_START = 0.4; // silencio al inicio
export const TAIL = 1.6; // segundos al final
export const FPS = 30;

/** Texto completo de la narración y en qué carácter empieza/termina cada escena. */
export function narrationParts(scenes: Scene[]) {
  let text = "";
  const parts: { from: number; to: number }[] = [];
  for (const s of scenes) {
    const from = text ? text.length + 1 : 0;
    text += (text ? " " : "") + s.narracion.trim();
    parts.push({ from, to: text.length });
  }
  return { text, parts };
}

function sceneTimings(starts: number[], total: number): Timing[] {
  return starts.map((st, i) => {
    const start = i === 0 ? 0 : Math.max(st - 0.25, 0);
    const next = i === starts.length - 1 ? total : Math.max(starts[i + 1] - 0.25, start + 1);
    return { start, length: next - start };
  });
}

/** Vista previa sin voz: ~2.5 palabras por segundo. */
export function estimateTimings(scenes: Scene[]) {
  const words: Word[] = [];
  const starts: number[] = [];
  let t = VOICE_START;
  for (const s of scenes) {
    starts.push(t);
    const ws = s.narracion.trim().split(/\s+/).filter(Boolean);
    const len = Math.max(ws.length / 2.5, 3);
    ws.forEach((w, i) => words.push({ text: w, start: t + (i * len) / ws.length, end: t + ((i + 1) * len) / ws.length }));
    t += len + 0.3;
  }
  const total = t + TAIL;
  return { words, timings: sceneTimings(starts, total), total };
}

/** Con la voz real: tiempos exactos a partir de la alineación de ElevenLabs. */
export function alignTimings(scenes: Scene[], a: Alignment) {
  const { parts } = narrationParts(scenes);
  const n = a.characters.length;
  const at = (i: number) => a.character_start_times_seconds[Math.min(Math.max(i, 0), n - 1)] ?? 0;

  const words: Word[] = [];
  let cur = "";
  let ws = 0;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) words.push({ text: cur, start: ws + VOICE_START, end: a.character_end_times_seconds[i - 1] + VOICE_START });
      cur = "";
    } else {
      if (!cur) ws = a.character_start_times_seconds[i];
      cur += ch;
    }
  });
  if (cur) words.push({ text: cur, start: ws + VOICE_START, end: a.character_end_times_seconds[n - 1] + VOICE_START });

  const voiceEnd = (a.character_end_times_seconds[n - 1] ?? 0) + VOICE_START;
  const starts = parts.map((p) => {
    let i = p.from;
    while (i < p.to - 1 && /\s/.test(a.characters[i] ?? "")) i++;
    return at(i) + VOICE_START;
  });
  const total = voiceEnd + TAIL;
  return { words, timings: sceneTimings(starts, total), total };
}

/** Momentos (en segundos dentro de la escena) en que aparece cada punto de una lista. */
export function itemTimes(count: number, length: number) {
  const first = 1.0;
  const span = Math.max(length - 2.2, 1.5);
  return Array.from({ length: count }, (_, k) => first + (k * span) / Math.max(count, 1));
}
