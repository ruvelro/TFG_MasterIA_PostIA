"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient, signIn } from "@/lib/auth/client";
import { loginSchema } from "@/lib/validation/auth";

// Formulario de login. Better Auth gestiona las cookies desde el cliente, por eso es un
// componente de cliente. Ofrece dos vías: email+contraseña y passkey (WebAuthn).
export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function goToApp() {
    router.push(callbackUrl);
    router.refresh();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setPending(true);
    const { error: signInError } = await signIn.email(parsed.data);
    setPending(false);

    // Mensaje genérico: no distinguimos "email inexistente" de "contraseña incorrecta"
    // para no facilitar la enumeración de usuarios.
    if (signInError) {
      setError("Email o contraseña incorrectos.");
      return;
    }
    goToApp();
  }

  async function handlePasskey() {
    setError(null);
    const result = await authClient.signIn.passkey();
    if (result?.error) {
      setError("No se pudo iniciar sesión con la passkey.");
      return;
    }
    goToApp();
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email webauthn"
            required
            className="border-muted/30 focus:border-primary rounded-md border px-3 py-2 outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Contraseña</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="border-muted/30 focus:border-primary rounded-md border px-3 py-2 outline-none"
          />
        </label>

        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="bg-primary rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {pending ? "Entrando…" : "Iniciar sesión"}
        </button>
      </form>

      <button
        type="button"
        onClick={handlePasskey}
        className="border-muted/30 hover:border-primary rounded-md border px-4 py-2 text-sm font-medium"
      >
        Entrar con passkey
      </button>
    </div>
  );
}
