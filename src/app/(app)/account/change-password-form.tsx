"use client";

import { useState } from "react";

import { authClient } from "@/lib/auth/client";
import { getPasswordError } from "@/lib/validation/password";

// Formulario de cambio de contraseña. Pide la contraseña actual (Better Auth la verifica en el
// servidor), valida la nueva con la MISMA política que el registro (feedback inmediato; el hook
// de servidor es la garantía real) y, al cambiarla, revoca el resto de sesiones por seguridad.
export function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setError("La nueva contraseña y su confirmación no coinciden.");
      return;
    }
    const policyError = getPasswordError(newPassword);
    if (policyError) {
      setError(policyError);
      return;
    }

    setPending(true);
    // revokeOtherSessions: cambiar la contraseña cierra el resto de sesiones abiertas, por si la
    // contraseña anterior estaba comprometida. La sesión actual se conserva.
    const { error: changeError } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setPending(false);

    if (changeError) {
      // Mensaje del servidor (p. ej. contraseña actual incorrecta o política de contraseña).
      setError(changeError.message ?? "No se pudo cambiar la contraseña.");
      return;
    }

    form.reset();
    setSuccess(true);
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Cambiar contraseña</h2>
        <p className="text-muted mt-1 text-sm">
          Al cambiarla se cerrarán el resto de sesiones abiertas en otros dispositivos.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Contraseña actual</span>
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            className="border-muted/30 focus:border-primary rounded-md border px-3 py-2 outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Nueva contraseña</span>
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            className="border-muted/30 focus:border-primary rounded-md border px-3 py-2 outline-none"
          />
          <span className="text-muted text-xs">
            Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Repite la nueva contraseña</span>
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            className="border-muted/30 focus:border-primary rounded-md border px-3 py-2 outline-none"
          />
        </label>

        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
        {success ? (
          <p role="status" className="text-sm text-green-600">
            Contraseña actualizada correctamente.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="bg-primary self-start rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {pending ? "Cambiando…" : "Cambiar contraseña"}
        </button>
      </form>
    </section>
  );
}
