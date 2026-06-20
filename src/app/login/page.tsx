import Link from "next/link";

import { LoginForm } from "./login-form";

// Página de login (pública). En Next.js 16 `searchParams` es asíncrono.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  // Solo aceptamos rutas internas como destino (defensa frente a open redirects).
  const safeCallback = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/generate";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <Link href="/" className="text-primary text-sm font-semibold">
          ← PostIA
        </Link>
        <h1 className="text-2xl font-bold">Iniciar sesión</h1>
        <p className="text-muted text-sm">Accede para generar y gestionar tus artículos.</p>
      </div>

      <LoginForm callbackUrl={safeCallback} />

      <p className="text-muted text-sm">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="text-primary font-medium">
          Crear cuenta
        </Link>
      </p>
    </main>
  );
}
