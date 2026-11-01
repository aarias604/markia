import { LegalShell } from "@/components/legal/LegalShell";
import { LEGAL, REGLAS } from "@/lib/legal";

export const metadata = { title: "Pagos, cancelación y reembolsos · Markia" };

export default function ReembolsosPage() {
  return (
    <LegalShell title="Pagos, cancelación y reembolsos">
      <h2>1. Cómo se paga</h2>
      <ul>
        <li><strong>Yappy Comercial:</strong> el cobro llega a tu app de Yappy y se confirma al instante.</li>
        <li>
          <strong>Criptomonedas (USDT):</strong> envías el monto exacto a la dirección indicada, en la red indicada, y
          registras el comprobante. Lo verificamos manualmente en un máximo de 24 horas. Las comisiones de red las paga
          quien envía. Si envías por una red distinta a la indicada, los fondos pueden perderse y no podemos recuperarlos.
        </li>
        <li>Los planes cubren ciclos de 30 días y se pagan por adelantado. No hay cobros automáticos.</li>
      </ul>

      <h2>2. Cancelación</h2>
      <p>
        Puedes cancelar cuando quieras: basta con no renovar. Seguirás teniendo acceso hasta el final del ciclo pagado. Si
        no pagas, se aplican el período de gracia y la suspensión descritos en los Términos y Condiciones. Si quieres que
        eliminemos tu cuenta y tus datos, escríbenos a {LEGAL.correoSoporte}.
      </p>

      <h2>3. Reembolsos de planes</h2>
      <ul>
        <li>
          <strong>Primer pago:</strong> si no quedas satisfecho, puedes pedir el reembolso completo dentro de los{" "}
          {REGLAS.reembolsoDias} días siguientes a tu primer pago, siempre que no hayas generado más de 3 publicaciones.
        </li>
        <li>Las renovaciones no son reembolsables una vez iniciado el ciclo, salvo fallas del servicio atribuibles a nosotros.</li>
        <li>Si cobramos dos veces por error, devolvemos el monto duplicado completo.</li>
      </ul>

      <h2>4. Reembolsos de servicios adicionales</h2>
      <ul>
        <li><strong>Boost de 5 publicaciones:</strong> reembolsable solo si no has usado ninguna de las 5.</li>
        <li><strong>Pack de Plantillas:</strong> reembolsable solo si no has creado plantillas con los espacios comprados.</li>
        <li><strong>Creación de Logo y Paleta:</strong> reembolsable completo si aún no empezamos el trabajo; luego, no reembolsable.</li>
      </ul>

      <h2>5. Cómo pedir un reembolso</h2>
      <p>
        Escribe a {LEGAL.correoSoporte} con el correo de tu cuenta y la fecha del pago. Respondemos en un máximo de 10 días
        hábiles. Los reembolsos se hacen por el mismo medio de pago cuando sea posible: Yappy al mismo celular y cripto a una
        dirección que nos indiques, en la misma moneda y por el mismo valor en dólares pagado. Un reembolso anula las
        comisiones de referidos asociadas a ese pago.
      </p>

      <h2>6. Reclamos</h2>
      <p>
        Si no estás conforme con nuestra respuesta, puedes acudir a la Autoridad de Protección al Consumidor y Defensa de la
        Competencia (ACODECO).
      </p>
    </LegalShell>
  );
}
