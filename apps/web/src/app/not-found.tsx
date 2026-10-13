import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-start justify-center">
      <p className="tag text-orange">404</p>
      <h1 className="h1 mt-2">No está</h1>
      <p className="mt-3 text-sm text-mute">Esta página no existe o se borró.</p>
      <Link href="/" className="btn btn-primary mt-6">
        Volver al panel
      </Link>
    </div>
  );
}
