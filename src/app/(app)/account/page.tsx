import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";

import { ChangePasswordForm } from "./change-password-form";
import { PasskeyManager } from "./passkey-manager";

// Página de cuenta: datos del usuario y gestión de passkeys. La sesión se verifica también
// aquí (además del layout) para tener el email disponible en el servidor.
export default async function AccountPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/login");

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="text-2xl font-bold">Tu cuenta</h1>
        <p className="text-muted mt-1 text-sm">
          {session.user.name} · {session.user.email}
        </p>
      </div>

      <PasskeyManager />

      <hr className="border-muted/20" />

      <ChangePasswordForm />
    </section>
  );
}
