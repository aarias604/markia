import { LegalShell } from "@/components/legal/LegalShell";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Política de Cookies · Markia" };

export default function CookiesPage() {
  return (
    <LegalShell title="Política de Cookies">
      <p>
        Las cookies son pequeños archivos que un sitio guarda en tu navegador. {LEGAL.marca} usa solo las necesarias para
        funcionar. No usamos cookies de publicidad ni de rastreo de terceros.
      </p>
      <h2>Qué usamos</h2>
      <ul>
        <li><strong>Sesión (sb-…):</strong> mantienen tu sesión iniciada de forma segura. Son de Supabase, nuestro proveedor de cuentas. Sin ellas no puedes entrar a tu cuenta.</li>
        <li><strong>Preferencias (almacenamiento local):</strong> recuerdan cosas como que ya cerraste el aviso de cookies o el código de referido con el que llegaste.</li>
        <li><strong>Pago con Yappy:</strong> el botón de Yappy puede usar sus propias cookies técnicas durante el pago.</li>
      </ul>
      <h2>Cómo controlarlas</h2>
      <p>
        Puedes borrar las cookies desde la configuración de tu navegador. Si borras las de sesión, tendrás que iniciar sesión
        de nuevo. Si en el futuro agregamos cookies de analítica o publicidad, te pediremos permiso antes.
      </p>
    </LegalShell>
  );
}
