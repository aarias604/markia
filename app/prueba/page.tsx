// Página de diagnóstico: comprueba la conexión con Supabase y con Claude.
// Abre http://localhost:3000/prueba. Bórrala antes de lanzar Markia.
import { Suspense } from "react";
import { connection } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

type Check = { ok: boolean; title: string; detail: string };

async function checkSupabase(): Promise<Check> {
  const title = "Supabase (base de datos)";
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { ok: false, title, detail: "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local." };
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("plans").select("name, price_cents").order("price_cents");
    if (error) return { ok: false, title, detail: `Supabase respondió con error: ${error.message}` };
    if (!data || data.length === 0) {
      return { ok: false, title, detail: "Conecta, pero la tabla plans está vacía. ¿Corriste el archivo SQL en la Fase 4?" };
    }
    const planes = data.map((p) => `${p.name} $${(p.price_cents / 100).toFixed(2)}`).join(" · ");
    return { ok: true, title, detail: `Conectado. Planes encontrados: ${planes}` };
  } catch (e) {
    return { ok: false, title, detail: `No se pudo conectar: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function checkClaude(): Promise<Check> {
  const title = "Claude (inteligencia artificial)";
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, title, detail: "Falta ANTHROPIC_API_KEY en .env.local." };
  }
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 60,
      messages: [{ role: "user", content: "Saluda en una frase corta a Markia, una app de redes sociales." }],
    });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    return { ok: true, title, detail: `Conectado. Claude dice: "${text}"` };
  } catch (e) {
    return { ok: false, title, detail: `No se pudo conectar: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export default function PruebaPage() {
  return (
    <main className="min-h-screen bg-[#FAF5EF] px-4 py-12 text-[#4A154B]">
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-bold">Markia · Prueba de conexiones</h1>
        <Suspense fallback={<p className="mt-8 text-sm opacity-70">Probando conexiones…</p>}>
          <Checks />
        </Suspense>
      </div>
    </main>
  );
}

async function Checks() {
  await connection(); // se ejecuta en cada visita, nunca desde caché
  const checks = await Promise.all([checkSupabase(), checkClaude()]);
  const allOk = checks.every((c) => c.ok);

  return (
    <>
        <p className="mt-2 text-sm opacity-70">
          {allOk ? "Todo listo. Puedes pasar a la Fase 6." : "Revisa lo que está en rojo y vuelve a cargar la página."}
        </p>

        <ul className="mt-8 space-y-4">
          {checks.map((c) => (
            <li
              key={c.title}
              className={`rounded-2xl border-2 bg-[#FDFBF7] p-5 ${c.ok ? "border-emerald-500" : "border-red-500"}`}
            >
              <p className="flex items-center gap-2 font-semibold">
                <span
                  className={`inline-block h-3 w-3 rounded-full ${c.ok ? "bg-emerald-500" : "bg-red-500"}`}
                  aria-hidden
                />
                {c.title}: {c.ok ? "funciona" : "falla"}
              </p>
              <p className="mt-2 break-words text-sm">{c.detail}</p>
            </li>
          ))}
        </ul>
    </>
  );
}
