import Link from "next/link";
import {
  CalendarDays,
  Check,
  Clock,
  Coins,
  Gift,
  HeartHandshake,
  Palette,
  PenLine,
  ShieldCheck,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react";
import { DemoVideos } from "@/components/landing/DemoVideos";
import { PricingCards } from "@/components/landing/PricingCards";
import { PostImage } from "@/components/posts/PostImage";
import { MarkiaLogo } from "@/components/ui/MarkiaLogo";
import { LEGAL_PAGES } from "@/components/legal/LegalShell";
import { LEGAL, REGLAS } from "@/lib/legal";
import { btnGold, btnPrimary, btnSecondary } from "@/lib/ui";

const DEMO_COLORS = { color_primary: "#1F3A5F", color_secondary: "#2E7D6B", color_accent: "#F2B544", color_cream: "#FFF8EC" };

const AYUDA = [
  { icon: Clock, title: "Recuperas tu tiempo", text: "Lo que te tomaba una tarde entera ahora lo haces en minutos: el mes de contenido, listo para revisar." },
  { icon: Target, title: "Constancia que se nota", text: "Publicar seguido es lo que hace crecer una cuenta. El calendario te ayuda a no dejar semanas vacías." },
  { icon: Palette, title: "Siempre con tu identidad", text: "Cada imagen sale con tu logo y tus colores. Tu marca se ve igual de profesional en cada publicación." },
  { icon: PenLine, title: "Habla como tu negocio", text: "La IA escribe con el tono que elegiste: cercano, profesional, divertido o elegante." },
];

const PASOS = [
  { n: "1", title: "Crea tu cuenta", text: "Regístrate con tu correo en menos de un minuto." },
  { n: "2", title: "Configura tu marca", text: "Sube tu logo, elige tus colores, tu nicho y tu tono de voz." },
  { n: "3", title: "Genera con IA", text: "Escribe una idea o deja que Markia te proponga temas. Recibe texto, hashtags e imagen." },
  { n: "4", title: "Descarga y publica", text: "Organízalas en el calendario y descarga cada imagen o carrusel con su descripción sugerida, lista para Instagram." },
];

const FAQ = [
  { q: "¿Necesito saber de diseño o de marketing?", a: "No. Markia se encarga del texto y del diseño. Tú solo revisas, ajustas si quieres y programas." },
  { q: "¿Hay contrato o cobro automático?", a: `No. Pagas mes a mes cuando quieras renovar. Te avisamos ${REGLAS.avisoDias} días antes del vencimiento y tienes ${REGLAS.graciaDias} días de gracia.` },
  { q: "¿Cómo pago?", a: "Con Yappy Comercial desde tu celular, o con criptomonedas (USDT). Todo en dólares." },
  { q: "¿De quién es el contenido que genero?", a: "Tuyo. Puedes usarlo en tus redes y materiales sin restricciones." },
  { q: "¿Y si no tengo logo?", a: "Puedes empezar sin logo, o usar nuestra Generación de Marca con IA: logo, colores, tipografías y guía en minutos." },
  { q: "¿Markia publica sola en Instagram?", a: "La publicación automática llega pronto al Plan PRO. Mientras tanto, descargas cada imagen con su descripción sugerida y la subes en segundos." },
  { q: "¿Cómo funciona el programa de referidos?", a: `Compartes tu enlace y ganas el ${REGLAS.referidoPorcentaje}% de cada mensualidad que pague quien se registre con él. Retiras desde US$${REGLAS.retiroMinimo} por banco o cripto.` },
];

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Navegación */}
      <header className="sticky top-0 z-30 border-b border-[#D9B382]/30 bg-[#FAF5EF]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <MarkiaLogo />
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <a href="#nosotros" className="hover:text-[#8C338A]">Nosotros</a>
            <a href="#como-funciona" className="hover:text-[#8C338A]">Cómo funciona</a>
            <a href="#marca" className="hover:text-[#8C338A]">Generación de marca</a>
            <a href="#planes" className="hover:text-[#8C338A]">Planes</a>
            <a href="#referidos" className="hover:text-[#8C338A]">Referidos</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden px-3 py-2 text-sm font-semibold hover:underline sm:inline">Iniciar sesión</Link>
            <Link href="/registro" className={btnPrimary}>Empezar</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute -right-40 -top-20 h-[28rem] w-[28rem] rounded-full bg-[#D9B382]/25 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-2 lg:pt-20">
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#D9B382]/30 px-4 py-1 text-xs font-bold uppercase tracking-wide">
              <Sparkles className="h-3.5 w-3.5" /> Hecho en Panamá para pymes y creadores
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.1] sm:text-6xl">
              Tu marca en redes, <span className="text-[#8C338A]">en piloto automático</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-[#4A154B]/75">
              Markia escribe, diseña y organiza las publicaciones de tu mes con tus colores, tu logo y tu forma de hablar.
              Tú revisas y programas.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/registro" className={btnGold}>Crear mi cuenta</Link>
              <a href="#como-funciona" className={btnSecondary}>Ver cómo funciona</a>
            </div>
            <p className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#4A154B]/70">
              <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4" /> Sin contratos</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4" /> Paga con Yappy o cripto</span>
            </p>
          </div>

          <div className="relative mx-auto grid w-full max-w-md grid-cols-2 gap-4">
            <div className="col-span-2 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/5">
              <PostImage definition={{ layout: "esquina", fondo: "primary", texto: "cream", detalle: "accent" }}
                colors={DEMO_COLORS} brandName="Café La Esquina" headline="Tu primer café de la mañana, a otro nivel"
                subtext="Pide para llevar desde las 6:30 a. m." />
            </div>
            <div className="overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/5">
              <PostImage definition={{ layout: "marco", fondo: "cream", texto: "primary", detalle: "accent" }}
                colors={DEMO_COLORS} brandName="Café La Esquina" headline="3 tips para tu café en casa" />
            </div>
            <div className="overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/5">
              <PostImage definition={{ layout: "dividido", fondo: "cream", texto: "secondary", detalle: "secondary" }}
                colors={DEMO_COLORS} brandName="Café La Esquina" headline="Nuevo: cold brew de la casa" />
            </div>
          </div>
        </div>
      </section>

      {/* Quiénes somos */}
      <section id="nosotros" className="bg-[#4A154B] text-[#FAF5EF]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-[#D9B382]">Quiénes somos</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Somos emprendedores que también sufrimos para publicar</h2>
          </div>
          <div className="space-y-4 text-[#FAF5EF]/80">
            <p>
              Markia nació en Panamá viendo un problema repetido en negocios pequeños: saben que necesitan estar en redes,
              pero entre atender clientes, proveedores y cuentas, nunca queda tiempo para crear contenido.
            </p>
            <p>
              Por eso unimos inteligencia artificial con diseño de marca en una herramienta sencilla, en español, con pagos
              locales y precios pensados para pymes y creadores. Nuestra meta es que cualquier negocio pueda verse
              profesional en redes sin contratar una agencia.
            </p>
            <div className="flex flex-wrap gap-6 pt-2 text-sm">
              <span className="inline-flex items-center gap-2"><HeartHandshake className="h-5 w-5 text-[#D9B382]" /> Soporte en español</span>
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#D9B382]" /> Tus datos protegidos (Ley 81)</span>
            </div>
          </div>
        </div>
      </section>

      {/* Cómo te ayudamos */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-center text-sm font-bold uppercase tracking-widest text-[#8C338A]">Cómo te ayudamos</p>
        <h2 className="mx-auto mt-3 max-w-2xl text-center text-3xl font-bold sm:text-4xl">Menos tiempo creando, más tiempo vendiendo</h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {AYUDA.map((f) => (
            <div key={f.title} className="rounded-2xl border border-[#D9B382]/40 bg-[#FDFBF7] p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#8C338A]/10">
                <f.icon className="h-6 w-6 text-[#8C338A]" />
              </span>
              <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-[#4A154B]/75">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="border-y border-[#D9B382]/40 bg-[#FDFBF7]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-center text-sm font-bold uppercase tracking-widest text-[#8C338A]">Cómo funciona</p>
          <h2 className="mt-3 text-center text-3xl font-bold sm:text-4xl">4 pasos y tu mes queda listo</h2>
          <ol className="mt-12 grid gap-8 md:grid-cols-4">
            {PASOS.map((p, i) => (
              <li key={p.n} className="relative">
                {i < PASOS.length - 1 && <span className="absolute left-12 top-6 hidden h-0.5 w-[calc(100%-2rem)] bg-[#D9B382]/50 md:block" />}
                <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#4A154B] text-lg font-bold text-[#D9B382]">{p.n}</span>
                <h3 className="mt-4 text-lg font-bold">{p.title}</h3>
                <p className="mt-1 text-sm text-[#4A154B]/75">{p.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 text-center">
            <Link href="/registro" className={btnPrimary}>Probar Markia</Link>
          </div>
        </div>
      </section>

      {/* Generación de marca */}
      <DemoVideos />

      <section id="marca" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-12 overflow-hidden rounded-3xl bg-gradient-to-br from-[#4A154B] via-[#6B21A8] to-[#8C338A] p-8 text-[#FAF5EF] sm:p-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#D9B382] px-4 py-1 text-xs font-bold uppercase tracking-wide text-[#4A154B]">
              <Wand2 className="h-3.5 w-3.5" /> Generación de marca
            </span>
            <h2 className="mt-5 text-3xl font-bold sm:text-4xl">¿Aún no tienes logo ni colores? Te los creamos</h2>
            <p className="mt-4 text-[#FAF5EF]/80">
              Cuéntanos de tu negocio y nuestra IA crea tu identidad visual en minutos. Recibes el paquete completo en tu
              correo, con instrucciones y sugerencias de uso, y puedes aplicarlo a Markia con un clic.
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              {["Logo en 3 versiones: principal, ícono y monocromo (SVG y PNG)", "Paleta de 5 colores con su uso recomendado", "2 tipografías gratuitas de Google Fonts", "Guía de uso: qué hacer, qué evitar e ideas de aplicación", "Un ajuste incluido"].map((t) => (
                <li key={t} className="flex gap-2"><Check className="h-5 w-5 shrink-0 text-[#D9B382]" /> {t}</li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/registro" className={btnGold}>Quiero mi marca · $19.99</Link>
              <span className="text-xs text-[#FAF5EF]/60">Pago único. Disponible en la Tienda de tu cuenta.</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              ["#4A154B", "Primario"], ["#6B21A8", "Secundario"], ["#D9B382", "Acento"], ["#FAF5EF", "Fondo"],
            ].map(([c, l]) => (
              <div key={c} className="text-center">
                <div className="aspect-[1/2] rounded-2xl shadow-lg ring-1 ring-white/20" style={{ background: c }} />
                <p className="mt-2 text-xs font-semibold">{l}</p>
                <p className="font-mono text-[10px] text-[#FAF5EF]/60">{c}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planes */}
      <section id="planes" className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
        <p className="text-center text-sm font-bold uppercase tracking-widest text-[#8C338A]">Planes</p>
        <h2 className="mt-3 text-center text-3xl font-bold sm:text-4xl">Precios simples, sin contratos</h2>
        <PricingCards />
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[#4A154B]/70">
          <span className="inline-flex items-center gap-2"><span className="rounded-md bg-[#0F4C81] px-2 py-0.5 text-xs font-bold text-white">Yappy</span> Pago desde tu celular</span>
          <span className="inline-flex items-center gap-2"><Coins className="h-4 w-4" /> Criptomonedas (USDT)</span>
          <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {REGLAS.graciaDias} días de gracia</span>
        </div>
      </section>

      {/* Referidos */}
      <section id="referidos" className="border-y border-[#D9B382]/40 bg-[#FDFBF7]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-[auto_1fr_auto]">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#D9B382]/30">
            <Gift className="h-8 w-8 text-[#8C338A]" />
          </span>
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Recomienda Markia y gana el {REGLAS.referidoPorcentaje}% cada mes</h2>
            <p className="mt-2 text-[#4A154B]/75">
              Comparte tu enlace. Por cada persona que se suscriba, recibes el {REGLAS.referidoPorcentaje}% de cada mensualidad
              que pague. Retira desde US${REGLAS.retiroMinimo} a tu cuenta bancaria o en cripto.
            </p>
          </div>
          <Link href="/registro" className={btnPrimary}>Unirme gratis</Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-bold">Preguntas frecuentes</h2>
        <div className="mt-10 divide-y divide-[#D9B382]/40 rounded-2xl border border-[#D9B382]/40 bg-[#FDFBF7]">
          {FAQ.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {f.q}
                <span className="text-xl text-[#8C338A] transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-[#4A154B]/75">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="rounded-3xl bg-[#4A154B] px-6 py-14 text-center text-[#FAF5EF]">
          <h2 className="text-3xl font-bold sm:text-4xl">Tu próximo mes de contenido está a 10 minutos</h2>
          <Link href="/registro" className={`${btnGold} mt-8`}>Crear mi cuenta</Link>
        </div>
      </section>

      {/* Pie de página con datos legales */}
      <footer className="border-t border-[#D9B382]/40 bg-[#FDFBF7]">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-sm sm:px-6 md:grid-cols-3">
          <div>
            <MarkiaLogo />
            <p className="mt-3 text-[#4A154B]/70">Contenido para redes con IA, hecho en Panamá.</p>
          </div>
          <div>
            <p className="font-bold">Legal</p>
            <ul className="mt-3 space-y-2">
              {LEGAL_PAGES.map((p) => (
                <li key={p.href}><Link href={p.href} className="text-[#4A154B]/75 hover:underline">{p.label}</Link></li>
              ))}
            </ul>
          </div>
          <div className="space-y-1 text-[#4A154B]/75">
            <p className="font-bold text-[#4A154B]">Contacto</p>
            <p className="pt-2">{LEGAL.razonSocial}</p>
            <p>RUC {LEGAL.ruc}</p>
            <p>{LEGAL.direccion}</p>
            <p>{LEGAL.correoSoporte} · {LEGAL.telefono}</p>
          </div>
        </div>
        <p className="border-t border-[#D9B382]/30 py-5 text-center text-xs text-[#4A154B]/60">
          © 2026 {LEGAL.marca}. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}
