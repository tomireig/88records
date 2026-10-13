import type { Metadata } from "next";

export const metadata: Metadata = { title: "Términos de uso" };

const contact = process.env.LEGAL_CONTACT_EMAIL || "el mail de contacto de 88RECORDS";

export default function Terms() {
  return (
    <>
      <h1>Términos de uso</h1>
      <p>
        El Panel TikTok™ de 88RECORDS® es una herramienta interna del sello para programar y publicar videos en cuentas de TikTok propias del
        sello y de sus artistas. Al usarlo aceptás estas condiciones.
      </p>

      <h2>Cuentas</h2>
      <ul>
        <li>Solo se conectan cuentas reales, propias o de artistas que lo autorizaron, mediante el login oficial de TikTok.</li>
        <li>No se crean cuentas, no se automatizan inicios de sesión y no se simula actividad.</li>
      </ul>

      <h2>Contenido</h2>
      <ul>
        <li>Sos responsable de tener los derechos del contenido que publicás, incluida la música.</li>
        <li>Cada publicación sale solo después de que la aprobás, con la privacidad y los permisos que elegiste.</li>
        <li>El contenido tiene que cumplir las Normas de la comunidad y las políticas de TikTok.</li>
      </ul>

      <h2>Disponibilidad</h2>
      <p>
        El panel depende de la API de TikTok. Si TikTok rechaza o demora una publicación, el panel muestra el motivo y permite reintentarla, pero no
        garantiza que salga en el horario exacto.
      </p>

      <h2>Contacto</h2>
      <p>Consultas: {contact}.</p>

      <p className="text-sm text-fg-3">Última actualización: 13 de octubre de 2026.</p>
    </>
  );
}
