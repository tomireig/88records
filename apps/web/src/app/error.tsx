"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-start justify-center">
      <p className="tag text-orange">Error</p>
      <h1 className="h1 mt-2">Algo falló</h1>
      <p className="mt-3 text-sm text-mute">No se pudo cargar esta parte. Probá de nuevo en un momento.</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-6">
        Reintentar
      </button>
    </div>
  );
}
