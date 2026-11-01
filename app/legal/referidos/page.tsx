import { LegalShell } from "@/components/legal/LegalShell";
import { LEGAL, REGLAS } from "@/lib/legal";

export const metadata = { title: "Términos del Programa de Referidos · Markia" };

export default function ReferidosTerminosPage() {
  return (
    <LegalShell title="Términos y Acuerdo del Programa de Referidos">
      <p>
        Este acuerdo regula el Programa de Referidos de {LEGAL.marca}. Se suma a los Términos y Condiciones generales y lo
        aceptas al marcar las casillas de aceptación en la sección «Referidos» de tu cuenta.
      </p>

      <h2>1. Quién puede participar</h2>
      <ul>
        <li>Cualquier persona mayor de 18 años con una cuenta registrada en {LEGAL.marca}, tenga o no un plan activo.</li>
        <li>Debes aceptar este acuerdo. Guardamos la fecha y la versión que aceptaste.</li>
        <li>Puedes participar a título personal o en nombre de tu empresa.</li>
      </ul>

      <h2>2. Cómo funciona</h2>
      <ol>
        <li>Al unirte recibes un código y un enlace personal.</li>
        <li>Es tu «referido» quien crea su cuenta usando tu enlace o tu código. El referido queda asociado a ti en el momento de su registro; no se puede asignar después.</li>
        <li>No puedes referirte a ti mismo ni a cuentas que controles.</li>
      </ol>

      <h2>3. Comisión</h2>
      <ul>
        <li>
          Ganas el <strong>{REGLAS.referidoPorcentaje}%</strong> de cada mensualidad de plan que tu referido pague y quede
          confirmada, mientras mantenga su suscripción pagada.
        </li>
        <li>El {REGLAS.referidoPorcentaje}% se calcula sobre el monto efectivamente pagado, después de descuentos.</li>
        <li>No generan comisión los servicios adicionales de la Tienda (Boost, Pack de Plantillas, Logo y Paleta).</li>
        <li>
          Cada comisión queda <strong>pendiente {REGLAS.referidoEsperaDias} días</strong> y después pasa a{" "}
          <strong>disponible</strong>. La espera protege contra reembolsos y pagos revertidos.
        </li>
        <li>Si el pago de tu referido se reembolsa o se anula, la comisión correspondiente se cancela. Si ya te fue pagada, podemos descontarla de comisiones futuras.</li>
      </ul>

      <h2>4. Retiros</h2>
      <ul>
        <li>Puedes solicitar un retiro cuando tengas al menos <strong>US${REGLAS.retiroMinimo}</strong> disponibles. Se retira todo el saldo disponible en ese momento.</li>
        <li>Puedes elegir entre dos métodos: <strong>transferencia bancaria</strong> a una cuenta en Panamá a tu nombre, o <strong>criptomoneda (USDT)</strong> a la dirección y red que indiques.</li>
        <li>Pagamos en un máximo de {REGLAS.pagoRetiroDiasHabiles} días hábiles desde la solicitud.</li>
        <li>Si tus datos están mal (cuenta, red o dirección), el pago puede perderse. Verifícalos bien; no respondemos por envíos a datos incorrectos que nos diste.</li>
        <li>Las comisiones bancarias o de red del envío pueden descontarse del monto.</li>
        <li>Podemos pedirte una identificación (cédula o pasaporte) antes de pagar, para prevenir fraude.</li>
        <li>Solo puedes tener una solicitud de retiro abierta a la vez.</li>
      </ul>

      <h2>5. Impuestos</h2>
      <p>
        Las comisiones son ingresos tuyos. Eres responsable de declararlas y pagar los impuestos que correspondan. Si la ley
        nos obliga a retener o informar, lo haremos.
      </p>

      <h2>6. Promoción responsable: lo que no está permitido</h2>
      <ul>
        <li>Enviar spam, mensajes masivos no solicitados o usar listas compradas.</li>
        <li>Hacer promesas falsas sobre {LEGAL.marca} (ingresos garantizados, funciones que no existen, descuentos inventados).</li>
        <li>Presentarte como empleado, socio o representante oficial de {LEGAL.marca}.</li>
        <li>Comprar anuncios usando la marca «{LEGAL.marca}» o palabras parecidas sin nuestro permiso escrito.</li>
        <li>Crear cuentas falsas, auto-referirte o pagar a personas para que se registren.</li>
      </ul>
      <p>
        Si incumples estas reglas podemos suspender tu participación y anular las comisiones obtenidas de forma indebida.
      </p>

      <h2>7. Relación entre las partes</h2>
      <p>
        Participas como referente independiente. Este programa no crea relación laboral, de agencia, sociedad ni franquicia
        con {LEGAL.marca}.
      </p>

      <h2>8. Cambios y fin del programa</h2>
      <ul>
        <li>Podemos cambiar estas condiciones o terminar el programa con al menos 15 días de aviso. Los cambios no afectan las comisiones ya ganadas.</li>
        <li>Puedes salir del programa cuando quieras escribiendo a {LEGAL.correoSoporte}. Te pagaremos el saldo disponible si supera el mínimo; si no lo supera, lo pagaremos de todas formas al cerrar tu participación, salvo que haya fraude.</li>
      </ul>

      <h2>9. Datos personales</h2>
      <p>
        Tratamos los datos de retiro (cuenta bancaria o billetera) solo para pagarte, conforme a nuestra Política de
        Privacidad. Por privacidad, no te mostramos los datos personales de tus referidos.
      </p>

      <h2>10. Ley aplicable</h2>
      <p>Este acuerdo se rige por las leyes de la República de Panamá.</p>
    </LegalShell>
  );
}
