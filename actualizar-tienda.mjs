// Ejecutar UNA vez desde la carpeta del proyecto:  node actualizar-tienda.mjs
// Agrega los nuevos paquetes a correos, reembolsos y avisos.
import fs from "node:fs";

if (!fs.existsSync("package.json") || !fs.existsSync("app")) {
  console.error("✗ Ejecuta este comando dentro de la carpeta del proyecto markia.");
  process.exit(1);
}

function edit(file, pairs) {
  if (!fs.existsSync(file)) return console.log("• No encontré", file);
  let s = fs.readFileSync(file, "utf8");
  for (const [a, b, done] of pairs) {
    if (done && s.includes(done)) continue; // ya estaba
    if (s.includes(a)) s = s.replace(a, b);
    else console.log(`• ${file}: no encontré «${a.slice(0, 50)}…»`);
  }
  fs.writeFileSync(file, s);
  console.log("✓ Actualizado:", file);
}

edit("lib/notifications.ts", [
  [
    '  posts_boost_5: "Boost de 5 publicaciones",\n',
    '  posts_boost_5: "Boost de 5 publicaciones",\n  posts_boost_10: "Boost de 10 publicaciones",\n  posts_boost_20: "Boost de 20 publicaciones",\n  video_pack_3: "Paquete de 3 videos",\n  video_pack_10: "Paquete de 10 videos",\n',
    "posts_boost_10",
  ],
]);

edit("app/legal/reembolsos/page.tsx", [
  [
    "<li><strong>Boost de 5 publicaciones:</strong> reembolsable solo si no has usado ninguna de las 5.</li>",
    "<li><strong>Boost de publicaciones (5, 10 o 20):</strong> reembolsable solo si no has usado ninguna de las publicaciones compradas.</li>\n        <li><strong>Paquetes de videos (3 o 10):</strong> reembolsable solo si no has creado ningún video con el paquete.</li>",
    "Paquetes de videos",
  ],
]);

edit("app/dashboard/generador/page.tsx", [
  ["Puedes comprar un Boost de 5 en la Tienda.", "Puedes comprar un Boost de 5, 10 o 20 en la Tienda.", "Boost de 5, 10 o 20"],
]);

console.log("\nListo.");
