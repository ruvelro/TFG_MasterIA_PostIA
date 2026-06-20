"use client";

import { useActionState } from "react";

import { authenticate, type LoginState } from "./actions";

const INITIAL_STATE: LoginState = {};

// Formulario de login controlado por `useActionState`: mantiene el estado de error
// devuelto por la Server Action y deshabilita el botón mientras se procesa el envío.
export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, pending] = useActionState(authenticate, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

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
          autoComplete="current-password"
          required
          className="border-muted/30 focus:border-primary rounded-md border px-3 py-2 outline-none"
        />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
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
  );
}
