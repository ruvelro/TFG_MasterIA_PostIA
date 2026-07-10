import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentSession } from "@/lib/auth/session";

/**
 * Layout de las rutas protegidas. Aquí está la barrera de seguridad REAL: verifica la
 * sesión en el servidor y redirige si no existe. El `proxy.ts` solo hace una comprobación
 * optimista previa; esta es la que no se puede saltar.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-muted/20 flex items-center justify-between border-b px-6 py-3">
        <nav className="flex items-center gap-4">
          <Link href="/generate" className="font-semibold">
            PostIA
          </Link>
          <Link href="/generate" className="text-muted hover:text-foreground text-sm">
            Generar
          </Link>
          <Link href="/articles" className="text-muted hover:text-foreground text-sm">
            Historial
          </Link>
          <Link href="/batches" className="text-muted hover:text-foreground text-sm">
            Lotes
          </Link>
          <Link href="/account" className="text-muted hover:text-foreground text-sm">
            Cuenta
          </Link>
          {session.user.role === "admin" ? (
            <Link href="/admin" className="text-muted hover:text-foreground text-sm">
              Admin
            </Link>
          ) : null}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">{session.user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
