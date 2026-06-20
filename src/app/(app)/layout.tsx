import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { logout } from "@/lib/auth/actions";

/**
 * Layout de las rutas protegidas. Aquí está la barrera de seguridad REAL: verifica la
 * sesión en el servidor con `auth()` y redirige si no existe. El `proxy.ts` solo hace una
 * comprobación optimista previa; esta es la que no se puede saltar.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
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
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">{session.user.email}</span>
          <form action={logout}>
            <button type="submit" className="text-primary font-medium">
              Salir
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
