import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de privacidad" };

const contact = process.env.LEGAL_CONTACT_EMAIL || "el mail de contacto de 88RECORDS";

export default function Privacy() {
  return (
    <>
      <h1>Política de privacidad</h1>
      <p>
        Esta política explica qué datos usa el Panel TikTok™ de 88RECORDS® (el «panel»), una herramienta interna del sello para programar y
        publicar videos en las cuentas de TikTok de 88RECORDS y de sus artistas.
      </p>

      <h2>Qué datos usamos</h2>
      <ul>
        <li>De tu cuenta del panel: tu mail, para iniciar sesión.</li>
        <li>
          De cada cuenta de TikTok que conectás: el identificador de la cuenta, el nombre visible, la foto de perfil y los tokens de acceso que
          TikTok entrega al autorizar. Nunca vemos ni guardamos la contraseña de TikTok.
        </li>
        <li>Los videos que subís, sus textos y la configuración de cada publicación (horario, privacidad, permisos).</li>
        <li>El estado de cada publicación que devuelve TikTok (procesando, publicado, error).</li>
      </ul>

      <h2>Para qué los usamos</h2>
      <p>
        Solo para publicar los videos que aprobaste, en la cuenta y el horario que elegiste, y para mostrarte su estado. No vendemos datos, no
        los compartimos con terceros con fines comerciales y no los usamos para publicidad.
      </p>

      <h2>Cómo los protegemos</h2>
      <p>
        Los tokens de TikTok se guardan cifrados con AES-256-GCM. Los videos se guardan en un almacenamiento privado con links que vencen. El
        acceso al panel está limitado a personas habilitadas por el sello.
      </p>

      <h2>Cuánto tiempo los guardamos</h2>
      <p>
        Mientras la cuenta esté conectada. Al desconectar una cuenta desde el panel se revoca la autorización en TikTok y se borran sus tokens. Los
        videos se borran cuando los eliminás de la biblioteca.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Podés pedir acceso, corrección o eliminación de tus datos escribiendo a {contact}. También podés quitarle el permiso a la app en cualquier
        momento desde la configuración de seguridad de tu cuenta de TikTok.
      </p>

      <p className="text-sm text-fg-3">Última actualización: 13 de octubre de 2026.</p>
    </>
  );
}
