// Datos que recibe la composición de Remotion (los mismos para la vista previa y el render).
import type { Scene, VideoStyle } from "../lib/video";
import type { Timing, Word } from "../lib/video-timing";

export type Colors = {
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  color_cream: string;
};

export type VideoProps = {
  scenes: Scene[];
  style: VideoStyle;
  colors: Colors;
  brandName: string;
  handle: string;
  logoUrl: string | null;
  voiceUrl: string | null;
  words: Word[];
  timings: Timing[];
  total: number;
  musicUrl: string | null;
  sfx: { whoosh: string; pop: string; ding: string } | null;
  subtitles: boolean;
};
