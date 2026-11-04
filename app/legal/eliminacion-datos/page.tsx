import { LegalShell } from "@/components/legal/LegalShell";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Eliminación de datos · Markia" };

export default function EliminacionDatosPage() {
  return (
    <LegalShell title="Cómo eliminar tus datos">
      <p>
        Puedes pedir en cualquier momento que eliminemos los datos que {LEGAL.marca} guarda sobre ti, incluidos los que
        obtenemos al conectar tu cuenta de Instagram.
      </p>

      <h2>Desconectar Instagram (inmediato)</h2>
      <ol>
        <li>Inicia sesión en {LEGAL.marca} y entra a <strong>Instagram</strong> en el menú.</li>
        <li>Pulsa <strong>Desconectar</strong>. Borramos al instante el permiso de acceso (token) y tu usuario de Instagram.</li>
        <li>
          También puedes quitar el acceso desde Instagram: Configuración → Apps y sitios web → selecciona {LEGAL.marca} →
          Eliminar.
        </li>
      </ol>

      <h2>Eliminar toda tu cuenta y tus datos</h2>
      <ol>
        <li>Escribe a <strong>{LEGAL.correoPrivacidad}</strong> desde el correo de tu cuenta con el asunto «Eliminar mis datos».</li>
        <li>
          En un máximo de 10 días hábiles eliminamos tu cuenta, tu kit de marca, tus publicaciones, tus imágenes y la conexión
          con Instagram, y te confirmamos por correo.
        </li>
        <li>
          Solo conservamos los registros de pagos que la ley panameña nos obliga a guardar por motivos fiscales y contables.
        </li>
      </ol>

      <h2>Qué datos de Instagram usamos</h2>
      <ul>
        <li>Tu nombre de usuario y el identificador de tu cuenta profesional.</li>
        <li>Un permiso de acceso para publicar en tu nombre las publicaciones que tú programas.</li>
        <li>El identificador y el enlace de las publicaciones que publicamos por ti.</li>
      </ul>
      <p>No leemos tus mensajes, comentarios ni seguidores, y nunca publicamos nada que tú no hayas programado.</p>
    </LegalShell>
  );
}
