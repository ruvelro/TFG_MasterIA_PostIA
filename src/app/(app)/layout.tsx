import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";

import { AppNav } from "./app-nav";

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
      <AppNav userEmail={session.user.email} isAdmin={session.user.role === "admin"} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
