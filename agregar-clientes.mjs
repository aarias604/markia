// Ejecutar UNA vez desde la carpeta del proyecto:  node agregar-clientes.mjs
// Agrega «Clientes» al menú de administrador.
import fs from "node:fs";

const file = "components/dashboard/DashboardShell.tsx";
if (!fs.existsSync(file)) {
  console.error("✗ Ejecuta este comando dentro de la carpeta del proyecto markia.");
  process.exit(1);
}
let s = fs.readFileSync(file, "utf8");
if (s.includes('"/dashboard/admin/clientes"')) {
  console.log("✓ El menú ya tenía «Clientes».");
  process.exit(0);
}
if (!/\bUsers,/.test(s)) s = s.replace("  ShieldCheck,\n", "  ShieldCheck,\n  Users,\n");
const line = '        { href: "/dashboard/admin", label: "Administración", icon: ShieldCheck },\n';
if (!s.includes(line) || !/\bUsers,/.test(s)) {
  console.error("✗ No encontré dónde agregar el menú. Avísale a Claude.");
  process.exit(1);
}
s = s.replace(line, line + '        { href: "/dashboard/admin/clientes", label: "Clientes", icon: Users },\n');
fs.writeFileSync(file, s);
console.log("✓ «Clientes» agregado al menú de administrador.");
