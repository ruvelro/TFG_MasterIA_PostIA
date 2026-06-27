"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { signUp } from "@/lib/auth/client";
import { registerSchema } from "@/lib/validation/auth";

// Formulario de registro. Valida con la misma política que el servidor (feedback inmediato)
// y delega en Better Auth, que con `autoSignIn` deja al usuario logueado tras crear la cuenta.
export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const parsed = registerSchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setPending(true);
    const { error: signUpError } = await signUp.email(parsed.data);
    setPending(false);

    if (signUpError) {
      // Mensaje del servidor (p. ej. email ya registrado o política de contraseña).
      setError(signUpError.message ?? "No se pudo crear la cuenta.");
      return;
    }

    router.push("/generate");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Nombre</span>
        <input
          name="name"
          type="text"
          autoComplete="name"
          required
          className="border-muted/30 focus:border-primary rounded-md border px-3 py-2 outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="border-muted/30 focus:border-primary rounded-md border px-3 py-2 outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Contraseña</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className="border-muted/30 focus:border-primary rounded-md border px-3 py-2 outline-none"
        />
        <span className="text-muted text-xs">
          Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo.
        </span>
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
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </button>
    </form>
  );
}
