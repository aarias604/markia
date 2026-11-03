import Link from "next/link";
import { LegalShell, Responsable } from "@/components/legal/LegalShell";
import { LEGAL, REGLAS } from "@/lib/legal";

export const metadata = { title: "Términos y Condiciones · Markia" };

export default function TerminosPage() {
  return (
    <LegalShell title="Términos y Condiciones de Uso">
      <p>
        Estos Términos regulan el uso de {LEGAL.marca} ({LEGAL.sitio}), una plataforma en línea que ayuda a negocios y
        creadores a crear, diseñar y programar contenido para redes sociales con inteligencia artificial. Al crear una
        cuenta y marcar la casilla de aceptación, celebras un contrato electrónico con el titular de {LEGAL.marca}, con
        la misma validez que un contrato firmado en papel.
      </p>

      <h2>1. Quién presta el servicio</h2>
      <Responsable />

      <h2>2. Requisitos para usar {LEGAL.marca}</h2>
      <ul>
        <li>Ser mayor de 18 años y tener capacidad legal para contratar, o actuar en nombre de una empresa con autorización para obligarla.</li>
        <li>Dar datos verdaderos y mantenerlos actualizados.</li>
        <li>Cuidar tu contraseña. Eres responsable de lo que se haga con tu cuenta.</li>
      </ul>

      <h2>3. El servicio</h2>
      <p>
        {LEGAL.marca} genera textos con inteligencia artificial (proveedor: Anthropic), crea imágenes con tus colores y
        tu logo a partir de plantillas, y te permite organizarlas en un calendario. El Plan PRO incluye publicación
        automática en Instagram cuando esa función esté disponible y conectes tu cuenta; depende de las reglas y la
        disponibilidad de Meta, que no controlamos.
      </p>

      <h2>4. Planes, precios y forma de pago</h2>
      <ul>
        <li>
          <strong>Plan Básico:</strong> 10 publicaciones y 1 carrusel con IA por ciclo, y 10 plantillas.{" "}
          <strong>Plan PRO:</strong> 26 publicaciones y 3 carruseles con IA por ciclo, 20 plantillas y 5 plantillas
          propias. La publicación automática en Instagram del Plan PRO está en desarrollo; mientras no esté disponible,
          puedes descargar cada publicación con su descripción sugerida. Los precios vigentes se muestran en la página de
          Planes antes de pagar.
        </li>
        <li>Los precios están en dólares de los Estados Unidos (USD). [Confirmar con tu contador si incluyen ITBMS.]</li>
        <li>Puedes pagar con Yappy Comercial o con criptomonedas (USDT) según las instrucciones del sitio. Los pagos con cripto se confirman manualmente en un plazo de hasta 24 horas.</li>
        <li>
          <strong>Cambio a PRO:</strong> si tienes el Plan Básico y estás al día, puedes cambiarte al Plan PRO pagando el primer
          mes PRO con 35% de descuento. El cambio aplica al confirmarse el pago y se suman 30 días a tu fecha de vencimiento.
          Desde la siguiente cuota pagas el precio normal del Plan PRO.
        </li>
        <li>Cada pago cubre un ciclo de 30 días. Las publicaciones no usadas no se acumulan al siguiente ciclo, salvo las compradas con el Boost.</li>
        <li>Podemos cambiar los precios con al menos 15 días de aviso por correo. El cambio aplica desde tu siguiente renovación.</li>
      </ul>

      <h2>5. Renovación, atraso y suspensión</h2>
      <p>
        {LEGAL.marca} no cobra de forma automática: cada renovación la pagas tú. Para ayudarte, aplicamos estas reglas:
      </p>
      <ol>
        <li><strong>Aviso:</strong> {REGLAS.avisoDias} días antes del vencimiento verás un aviso para renovar. Si pagas, tu fecha de vencimiento se extiende 30 días.</li>
        <li>
          <strong>Período de gracia:</strong> si no pagas al vencimiento, tu cuenta sigue funcionando {REGLAS.graciaDias} días.
          Para ponerte al día pagas los 2 meses acumulados: el mes vencido y el mes en curso.
        </li>
        <li>
          <strong>Suspensión:</strong> si pasan los {REGLAS.graciaDias} días sin pago, la cuenta se suspende y se bloquea el
          generador. Tus datos se conservan según la Política de Privacidad. Para reactivarla te ofrecemos un{" "}
          {REGLAS.descuentoReactivacion}% de descuento sobre los 2 meses acumulados. Es una oferta, no una deuda exigible:
          si no reactivas, no te cobraremos esos montos.
        </li>
      </ol>

      <h2>6. Cancelación y reembolsos</h2>
      <p>
        Puedes dejar de usar {LEGAL.marca} cuando quieras simplemente no renovando. Las reglas de reembolso están en{" "}
        <Link href="/legal/reembolsos">Pagos, cancelación y reembolsos</Link>.
      </p>

      <h2>7. Contenido generado con IA</h2>
      <ul>
        <li>Los textos e imágenes los produce un sistema automático y pueden contener errores. Revisa todo antes de publicarlo; tú decides qué publicas y eres responsable de ello.</li>
        <li>No incluyas precios, promociones, testimonios o datos que no sean ciertos. La ley panameña de protección al consumidor prohíbe la publicidad engañosa.</li>
        <li>No uses {LEGAL.marca} para crear contenido ilegal, difamatorio, discriminatorio, sexual con menores, que infrinja marcas o derechos de autor de otros, o que suplante a otra persona.</li>
      </ul>

      <h2>8. Propiedad intelectual</h2>
      <ul>
        <li><strong>Lo tuyo es tuyo:</strong> conservas los derechos sobre tu logo, tus datos de marca y el contenido que generes y publiques. Nos das permiso limitado para almacenarlo y procesarlo solo para prestarte el servicio.</li>
        <li><strong>Lo nuestro es nuestro:</strong> el software, las plantillas, el diseño y la marca {LEGAL.marca} nos pertenecen. Puedes usar las imágenes que generes con nuestras plantillas, pero no copiar ni revender las plantillas ni la plataforma.</li>
      </ul>

      <h2>9. Servicios adicionales</h2>
      <p>
        Los add-ons de la Tienda (Boost de publicaciones, Pack de Plantillas y Generación de Marca con IA) son pagos
        únicos.
      </p>
      <h3>Generación de Marca con IA</h3>
      <ul>
        <li>Incluye un logo en 3 versiones (SVG y PNG), una paleta de colores, recomendaciones de tipografías gratuitas y una guía de uso, generados por inteligencia artificial a partir de los datos que nos das. Se entrega en tu cuenta y por correo.</li>
        <li>Incluye 1 ajuste. Los diseños son sencillos y vectoriales; no se trata de un servicio de diseñador humano.</li>
        <li>El resultado es tuyo: puedes usarlo, modificarlo y registrarlo. Como la IA puede producir diseños parecidos a otros existentes, antes de registrarlo como marca verifica en la Dirección General del Registro de la Propiedad Industrial (DIGERPI) que no haya una marca igual o similar. {LEGAL.marca} no garantiza que el diseño sea registrable.</li>
      </ul>

      <h2>10. Programa de referidos</h2>
      <p>
        La participación es voluntaria y se rige por los <Link href="/legal/referidos">Términos del Programa de Referidos</Link>,
        que debes aceptar por separado.
      </p>

      <h2>11. Disponibilidad y cambios</h2>
      <p>
        Trabajamos para que {LEGAL.marca} esté disponible siempre, pero puede haber interrupciones por mantenimiento o
        fallas de proveedores (alojamiento, inteligencia artificial, Yappy, Meta). Podemos mejorar o cambiar funciones;
        si un cambio reduce de forma importante lo que contrataste, te avisaremos y podrás pedir el reembolso proporcional
        del tiempo no usado.
      </p>

      <h2>12. Responsabilidad</h2>
      <p>
        En la medida que permita la ley panameña, nuestra responsabilidad total frente a ti por cualquier reclamo se
        limita a lo que nos pagaste en los 3 meses anteriores al hecho. No respondemos por decisiones que tomes con base en
        contenido generado por IA ni por la suspensión de tus cuentas en redes sociales por parte de terceros. Nada de lo
        anterior limita los derechos que te reconoce la Ley 45 de 2007 de protección al consumidor.
      </p>

      <h2>13. Suspensión por mal uso</h2>
      <p>
        Podemos suspender o cerrar cuentas que incumplan estos Términos, intenten vulnerar la seguridad o usen el servicio
        para fraude. Si cerramos tu cuenta sin culpa tuya, te devolvemos la parte proporcional no usada.
      </p>

      <h2>14. Comunicaciones electrónicas</h2>
      <p>
        Aceptas recibir avisos de servicio (pagos, vencimientos, cambios de estos Términos) por correo y dentro de la
        plataforma. Los documentos y registros electrónicos de tu aceptación tienen plena validez conforme a la Ley 51 de
        2008 de documentos y firmas electrónicas.
      </p>

      <h2>15. Cambios a estos Términos</h2>
      <p>
        Si cambiamos estos Términos te avisaremos con al menos 15 días de anticipación. Si no estás de acuerdo, puedes
        dejar de usar el servicio antes de que entren en vigor.
      </p>

      <h2>16. Ley aplicable y reclamos</h2>
      <p>
        Estos Términos se rigen por las leyes de la República de Panamá. Antes de cualquier reclamo formal, escríbenos a{" "}
        {LEGAL.correoSoporte}; respondemos en un máximo de 10 días hábiles. Como consumidor, también puedes acudir a la
        Autoridad de Protección al Consumidor y Defensa de la Competencia (ACODECO). Cualquier controversia se resolverá
        ante los tribunales competentes de la Ciudad de Panamá.
      </p>
    </LegalShell>
  );
}
