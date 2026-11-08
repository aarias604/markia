// Registro de la composición para Remotion (render en AWS Lambda y estudio local).
// Los props por defecto van escritos aquí mismo para que el estudio pueda editarlos;
// los tiempos se calculan solos en calculateMetadata si vienen vacíos.
import { Composition } from "remotion";
import { estimateTimings, FPS } from "../lib/video-timing";
import { MarkiaVideo } from "./MarkiaVideo";
import type { VideoProps } from "./types";

export function RemotionRoot() {
  return (
    <Composition
      id="MarkiaVideo"
      component={MarkiaVideo}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={FPS * 20}
      defaultProps={{
        scenes: [
          { layout: "portada", narracion: "Te explico cómo crear contenido para tu negocio en cuatro pasos.", titulo: "Contenido en 4 pasos", texto: "más fácil de lo que crees", icono: "cohete", sfx: "whoosh" },
          { layout: "lista", narracion: "Primero define tu idea: de qué trata, qué quieres mostrar y para quién es.", titulo: "Define tu idea", puntos: ["De qué trata", "Qué quieres mostrar", "Para quién"], icono: "idea", sfx: "whoosh" },
          { layout: "icono", narracion: "Después elige los colores de tu marca para que todo se vea tuyo.", titulo: "Súmale tus colores", texto: "Tu paleta en cada escena", icono: "brillo", sfx: "whoosh" },
          { layout: "dato", narracion: "Las cuentas que publican tres veces por semana crecen mucho más rápido.", titulo: "Publica con constancia", dato: "3x", icono: "crecimiento", sfx: "ding" },
          { layout: "comparacion", narracion: "Antes tardabas horas editando. Ahora lo haces en minutos.", titulo: "Antes y ahora", izquierda: { titulo: "Antes", texto: "Horas editando cada video" }, derecha: { titulo: "Ahora", texto: "Listo en minutos con Markia" }, icono: "reloj", sfx: "pop" },
          { layout: "cierre", narracion: "Síguenos para más ideas como esta.", titulo: "Sigue a Markia", icono: "corazon", sfx: "pop" },
        ],
        colors: { color_primary: "#4A154B", color_secondary: "#8C338A", color_accent: "#D9734E", color_cream: "#FAF5EF" },
        brandName: "Markia",
        handle: "markiapa",
        logoUrl: null,
        voiceUrl: null,
        words: [],
        timings: [],
        total: 0,
        musicUrl: null,
        sfx: null,
        subtitles: true,
      } satisfies VideoProps}
      calculateMetadata={({ props }) => {
        if (props.timings.length === props.scenes.length && props.total > 0) {
          return { durationInFrames: Math.max(Math.ceil(props.total * FPS), FPS) };
        }
        const t = estimateTimings(props.scenes);
        return {
          durationInFrames: Math.max(Math.ceil(t.total * FPS), FPS),
          props: { ...props, words: t.words, timings: t.timings, total: t.total },
        };
      }}
    />
  );
}
