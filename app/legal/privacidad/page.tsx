import { LegalShell, Responsable } from "@/components/legal/LegalShell";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Política de Privacidad · Markia" };

const PROVEEDORES = [
  ["Supabase", "Base de datos, cuentas y archivos (logos)", "Estados Unidos"],
  ["Vercel", "Alojamiento del sitio web", "Estados Unidos"],
  ["Anthropic", "Inteligencia artificial que redacta los textos (recibe tu nicho, tono e ideas, no tu contraseña ni datos de pago)", "Estados Unidos"],
  ["Banco General · Yappy Comercial", "Procesamiento de pagos con Yappy", "Panamá"],
  ["Lulubit", "Recepción de pagos con criptomonedas", "Panamá"],
  ["Meta (Instagram)", "Publicación automática, solo si conectas tu cuenta", "Estados Unidos"],
];

export default function PrivacidadPage() {
  return (
    <LegalShell title="Política de Privacidad y Protección de Datos Personales">
      <p>
        Esta política explica cómo tratamos tus datos personales conforme a la Ley 81 de 26 de marzo de 2019 sobre
        Protección de Datos Personales y su reglamento, el Decreto Ejecutivo 285 de 2021, de la República de Panamá.
      </p>

      <h2>1. Responsable del tratamiento</h2>
      <Responsable />
      <p>Para cualquier tema de privacidad escríbenos a <strong>{LEGAL.correoPrivacidad}</strong>.</p>

      <h2>2. Qué datos recogemos</h2>
      <ul>
        <li><strong>Cuenta:</strong> nombre, correo electrónico y contraseña (guardada cifrada; nosotros no podemos verla).</li>
        <li><strong>Marca:</strong> nombre del negocio, logo, colores, nicho y tono de voz.</li>
        <li><strong>Contenido:</strong> ideas que escribes, publicaciones generadas, fechas programadas.</li>
        <li><strong>Pagos:</strong> número de celular de Yappy, montos, fechas, números de orden y confirmación. Para pagos con cripto: red y comprobante de la transacción. No guardamos datos de tarjetas.</li>
        <li><strong>Programa de referidos:</strong> quién te refirió, tus comisiones y, si pides un retiro, los datos bancarios o la dirección de billetera que nos des.</li>
        <li><strong>Técnicos:</strong> la información mínima que requieren las cookies esenciales de sesión y los registros de seguridad del servidor.</li>
      </ul>
      <p>No recogemos datos sensibles (salud, religión, biométricos, etc.) y te pedimos no incluirlos en tus ideas.</p>

      <h2>3. Para qué los usamos</h2>
      <ol>
        <li>Crear tu cuenta y prestarte el servicio contratado (base: el contrato que aceptas).</li>
        <li>Procesar pagos, renovaciones, comisiones y retiros (base: contrato y obligaciones legales y contables).</li>
        <li>Enviarte avisos de servicio, como vencimientos o cambios de condiciones (base: contrato).</li>
        <li>Prevenir fraude y proteger la plataforma (base: interés legítimo y obligaciones legales).</li>
        <li>Enviarte novedades o promociones, solo si lo aceptas aparte; puedes darte de baja en cualquier momento.</li>
      </ol>
      <p>No vendemos ni alquilamos tus datos.</p>

      <h2>4. Con quién los compartimos</h2>
      <p>Usamos proveedores que tratan datos por cuenta nuestra y solo para prestarte el servicio:</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#D9B382]/60 text-left">
              <th className="py-2 pr-4">Proveedor</th><th className="py-2 pr-4">Para qué</th><th className="py-2">País</th>
            </tr>
          </thead>
          <tbody>
            {PROVEEDORES.map(([n, f, p]) => (
              <tr key={n} className="border-b border-[#D9B382]/30 align-top">
                <td className="py-2 pr-4 font-medium">{n}</td><td className="py-2 pr-4">{f}</td><td className="py-2">{p}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <strong>Transferencia internacional:</strong> algunos proveedores guardan datos en servidores fuera de Panamá,
        principalmente en Estados Unidos, con medidas de seguridad y contratos de protección de datos. Al aceptar esta
        política consientes esa transferencia, que es necesaria para prestar el servicio. También podemos entregar datos
        cuando lo ordene una autoridad competente.
      </p>

      <h2>5. Cuánto tiempo los guardamos</h2>
      <ul>
        <li>Mientras tu cuenta esté activa.</li>
        <li>Si la cuenta queda suspendida o la cierras, conservamos tus datos de marca y contenido 12 meses por si deseas volver, y luego los eliminamos o anonimizamos.</li>
        <li>Los registros de pagos y comisiones se conservan el tiempo que exigen las normas fiscales y contables de Panamá.</li>
      </ul>

      <h2>6. Tus derechos</h2>
      <p>Puedes ejercer en cualquier momento, sin costo, los derechos que te da la Ley 81 de 2019:</p>
      <ul>
        <li><strong>Acceso:</strong> saber qué datos tenemos de ti. Respondemos en un máximo de 10 días hábiles.</li>
        <li><strong>Rectificación:</strong> corregir datos incorrectos o incompletos. Lo hacemos en un máximo de 5 días hábiles.</li>
        <li><strong>Cancelación:</strong> pedir que eliminemos tus datos cuando ya no sean necesarios.</li>
        <li><strong>Oposición:</strong> oponerte a un tratamiento por motivos fundados.</li>
        <li><strong>Portabilidad:</strong> recibir tus datos en un formato de uso común.</li>
        <li><strong>Revocar tu consentimiento,</strong> sin efecto sobre lo ya tratado.</li>
      </ul>
      <p>
        Escribe a <strong>{LEGAL.correoPrivacidad}</strong> desde el correo de tu cuenta, indicando qué derecho deseas
        ejercer. Si no respondemos a tiempo o no estás conforme, puedes presentar una queja ante la Autoridad Nacional de
        Transparencia y Acceso a la Información (ANTAI).
      </p>

      <h2>7. Seguridad</h2>
      <p>
        Usamos conexiones cifradas (HTTPS), contraseñas cifradas, control de acceso para que cada usuario vea solo su
        información y claves secretas guardadas fuera del código. Si ocurre un incidente que afecte tus datos, te
        avisaremos lo antes posible y tomaremos medidas para reducir el impacto.
      </p>

      <h2>8. Menores de edad</h2>
      <p>{LEGAL.marca} es solo para mayores de 18 años. Si detectamos una cuenta de un menor, la eliminaremos.</p>

      <h2>9. Cookies</h2>
      <p>Usamos solo cookies esenciales para mantener tu sesión. Detalles en la Política de Cookies.</p>

      <h2>10. Cambios</h2>
      <p>Si cambiamos esta política te avisaremos por correo o dentro de la plataforma antes de que entre en vigor.</p>
    </LegalShell>
  );
}
