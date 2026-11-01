import Link from "next/link";
import { CalendarDays, Palette, Sparkles } from "lucide-react";
import { MarkiaLogo } from "@/components/ui/MarkiaLogo";
import { btnGold, btnPrimary, btnSecondary } from "@/lib/ui";

const FEATURES = [
  { icon: Palette, title: "Tu kit de marca", text: "Sube tu logo y tus colores una sola vez. Cada publicación sale con tu identidad." },
  { icon: Sparkles, title: "Textos con IA", text: "Claude escribe tus publicaciones con el tono de tu negocio, listas para Instagram." },
  { icon: CalendarDays, title: "Calendario", text: "Organiza el mes completo arrastrando cada publicación al día que quieras." },
];

const PLANES = [
  { name: "Plan Básico", price: "$19", items: ["10 publicaciones con IA al mes", "5 plantillas de diseño", "Calendario de contenido"] },
  { name: "Plan PRO", price: "$39", items: ["26 publicaciones con IA al mes", "5 plantillas + 5 propias", "Publicación automática en Instagram"], featured: true },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <MarkiaLogo />
        <nav className="flex items-center gap-2">
          <Link href="/login" className="px-3 py-2 text-sm font-semibold hover:underline">
            Iniciar sesión
          </Link>
          <Link href="/registro" className={btnPrimary}>
            Crear cuenta
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 text-center sm:px-6 sm:pt-20">
        <span className="inline-block rounded-full bg-[#D9B382]/30 px-4 py-1 text-xs font-bold uppercase tracking-wide">
          Para pymes y creadores de Panamá
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">
          Tu marca en redes, <span className="text-[#8C338A]">en piloto automático</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-[#4A154B]/75">
          Markia crea las publicaciones del mes con tus colores, tu logo y tu forma de hablar. Tú solo revisas y programas.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/registro" className={btnGold}>
            Empezar ahora
          </Link>
          <Link href="/login" className={btnSecondary}>
            Ya tengo cuenta
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 sm:grid-cols-3 sm:px-6">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl border border-[#D9B382]/40 bg-[#FDFBF7] p-6">
            <f.icon className="h-7 w-7 text-[#8C338A]" />
            <h2 className="mt-3 text-lg font-bold">{f.title}</h2>
            <p className="mt-1 text-sm text-[#4A154B]/75">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-24 sm:px-6">
        <h2 className="text-center text-3xl font-bold">Planes simples, pago con Yappy</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {PLANES.map((p) => (
            <div
              key={p.name}
              className={`rounded-3xl p-7 ${p.featured ? "bg-[#4A154B] text-[#FAF5EF]" : "border border-[#D9B382]/50 bg-[#FDFBF7]"}`}
            >
              <p className="font-semibold">{p.name}</p>
              <p className="mt-2 text-4xl font-bold">
                {p.price}
                <span className="text-base font-normal opacity-70">/mes</span>
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {p.items.map((i) => (
                  <li key={i}>✓ {i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#D9B382]/40 py-8 text-center text-xs text-[#4A154B]/60">
        © Markia · Panamá
      </footer>
    </div>
  );
}
