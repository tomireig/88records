"use client";

// Botón de submit que pide confirmación antes de mandar el form (para borrar cosas).
export function ConfirmButton({
  message,
  children,
  className = "btn btn-sm",
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
