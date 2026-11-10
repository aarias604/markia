// Ejecutar UNA vez desde la carpeta del proyecto:  node actualizar-planes.mjs
// Cambia los textos fijos: Básico 15 publicaciones y PRO 35 publicaciones.
import fs from "node:fs";

if (!fs.existsSync("package.json") || !fs.existsSync("app")) {
  console.error("✗ Ejecuta este comando dentro de la carpeta del proyecto markia.");
  process.exit(1);
}

function edit(file, pairs) {
  if (!fs.existsSync(file)) return console.log("• No encontré", file);
  let s = fs.readFileSync(file, "utf8");
  for (const [a, b] of pairs) {
    if (s.includes(b)) continue;
    if (s.includes(a)) s = s.replace(a, b);
    else console.log(`• ${file}: no encontré «${a}»`);
  }
  fs.writeFileSync(file, s);
  console.log("✓ Actualizado:", file);
}

edit("app/legal/terminos/page.tsx", [
  ["<strong>Plan Básico:</strong> 10 publicaciones,", "<strong>Plan Básico:</strong> 15 publicaciones,"],
  ["<strong>Plan PRO:</strong> 26 publicaciones,", "<strong>Plan PRO:</strong> 35 publicaciones,"],
]);
edit("app/dashboard/page.tsx", [["26 publicaciones, 3 carruseles", "35 publicaciones, 3 carruseles"]]);

console.log("\nListo.");
