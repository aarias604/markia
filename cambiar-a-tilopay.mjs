// Ejecutar UNA vez desde la carpeta del proyecto:  node cambiar-a-tilopay.mjs
// 1) Borra los archivos de Pagadito.  2) Cambia Pagadito por Tilopay en Términos y Privacidad.
import fs from "node:fs";

if (!fs.existsSync("package.json") || !fs.existsSync("app")) {
  console.error("✗ Ejecuta este comando dentro de la carpeta del proyecto markia.");
  process.exit(1);
}

// 1. Archivos de Pagadito que ya no se usan
for (const p of ["app/api/pagadito", "app/api/cron/pagadito", "lib/pagadito.ts", "lib/pagadito-sync.ts"]) {
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
    console.log("✓ Borrado:", p);
  }
}

// 2. Textos legales
function edit(file, pairs) {
  if (!fs.existsSync(file)) return console.log("• No encontré", file);
  let s = fs.readFileSync(file, "utf8");
  for (const [a, b] of pairs) {
    if (typeof a === "string" ? s.includes(a) : a.test(s)) s = s.replace(a, b);
    else console.log(`• ${file}: no encontré «${String(a).slice(0, 50)}…» (puede que ya estuviera cambiado)`);
  }
  s = s.replaceAll("Pagadito", "Tilopay");
  fs.writeFileSync(file, s);
  console.log("✓ Actualizado:", file);
}

edit("app/legal/terminos/page.tsx", [
  [
    /Los cobros se programan por un máximo de 12 meses; al terminar te pediremos renovar la\s+autorización\./,
    "Tilopay guarda tu tarjeta de forma segura; Markia solo conserva un identificador (token), la marca y los últimos 4 dígitos para poder cobrarla.",
  ],
  [/y los cobros futuros se anulan\./, "y no se harán más cobros."],
  [
    /Si un cobro es rechazado, la\s+renovación automática se desactiva/,
    "Si un cobro es rechazado, lo reintentaremos hasta 3 veces (una vez por día); si sigue rechazado, la renovación automática se desactiva",
  ],
]);

edit("app/legal/privacidad/page.tsx", [
  [
    /\["Pagadito",[^\]]*\]/,
    '["Tilopay", "Procesamiento de pagos con tarjeta y renovación automática. Los datos de tu tarjeta los recibe y guarda solo Tilopay", "Costa Rica / Centroamérica"]',
  ],
  [
    "los identificadores y referencias que entrega Pagadito y las fechas de los cobros programados",
    "el identificador (token) de la tarjeta guardada por Tilopay, su marca, sus últimos 4 dígitos y las referencias de cada cobro",
  ],
]);

// 3. Ventana de pago, panel y tarea programada
edit("components/billing/YappyCheckout.tsx", [["NEXT_PUBLIC_PAGADITO_ENABLED", "NEXT_PUBLIC_TILOPAY_ENABLED"]]);
edit("components/dashboard/DashboardContext.tsx", [
  [
    /autopay: \{[^}]*remaining: number; last_charge_date: string \} \| null;/,
    "autopay: {\n    mandate_id: string; plan_id: string; monthly_price_cents: number; next_charge_date: string | null;\n    remaining: number | null; last_charge_date: string | null; provider: string; card_brand: string | null; card_last4: string | null;\n  } | null;",
  ],
]);
edit("vercel.json", [["/api/cron/pagadito", "/api/cron/tilopay"]]);

console.log("\nListo. Ahora sigue con el paso de git (commit y push).");
