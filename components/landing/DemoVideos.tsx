"use client";

// Carrusel de videos de muestra en la página de inicio.
// Para mostrarlos, pon los archivos en /public/demo/video-1.mp4, video-2.mp4 y video-3.mp4.
// Los que no existan se ocultan solos; si no hay ninguno, la sección no aparece.
import { useState } from "react";
import { Clapperboard } from "lucide-react";

const SOURCES = ["/demo/video-1.mp4", "/demo/video-2.mp4", "/demo/video-3.mp4"];

export function DemoVideos() {
  const [failed, setFailed] = useState<string[]>([]);
  const visible = SOURCES.filter((s) => !failed.includes(s));
  if (visible.length === 0) return null;

  return (
    <section id="videos" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <p className="flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#8C338A]">
        <Clapperboard className="h-4 w-4" /> Videos con IA
      </p>
      <h2 className="mt-2 text-center text-3xl font-bold sm:text-4xl">Videos animados para Reels en pocos clics</h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-[#4A154B]/70">
        Escribe tu idea o tu propia narración: Markia crea el guion, la voz, la animación, los subtítulos y los efectos con
        los colores de tu marca. Estos videos los hicimos con Markia.
      </p>
      <div className="mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 sm:justify-center">
        {SOURCES.map((src) =>
          failed.includes(src) ? null : (
            <div key={src} className="w-64 shrink-0 snap-center overflow-hidden rounded-3xl bg-black shadow-xl sm:w-72">
              <video src={src} className="aspect-[9/16] w-full object-cover" autoPlay muted loop playsInline controls preload="metadata"
                onError={() => setFailed((f) => [...f, src])} />
            </div>
          )
        )}
      </div>
    </section>
  );
}
