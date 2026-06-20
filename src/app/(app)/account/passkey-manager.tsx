"use client";

import { useState } from "react";

import { authClient } from "@/lib/auth/client";

// Gestiona las passkeys del usuario: listar, registrar una nueva (WebAuthn) y eliminar.
// Es un método de acceso ADICIONAL y opcional; la cuenta siempre conserva su contraseña.
//
// Usamos el hook reactivo `useListPasskeys` de Better Auth: registrar o eliminar una
// passkey invalida su store automáticamente, así que la lista se refresca sola sin que
// tengamos que orquestar `useEffect`/`setState`.
export function PasskeyManager() {
  const { data: passkeys, isPending } = authClient.useListPasskeys();
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    const name = window.prompt("Nombre para identificar esta passkey (p. ej. 'MacBook'):");
    if (name === null) return; // cancelado por el usuario

    // `addPasskey` falla si el navegador no soporta WebAuthn o el usuario cancela el diálogo.
    const result = await authClient.passkey.addPasskey({ name: name.trim() || undefined });
    if (result?.error) {
      setError("No se pudo registrar la passkey.");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    const { error: deleteError } = await authClient.passkey.deletePasskey({ id });
    if (deleteError) {
      setError("No se pudo eliminar la passkey.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Passkeys</h2>
        <button
          type="button"
          onClick={handleAdd}
          className="bg-primary rounded-md px-3 py-1.5 text-sm font-medium text-white"
        >
          Añadir passkey
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {isPending ? (
        <p className="text-muted text-sm">Cargando…</p>
      ) : !passkeys || passkeys.length === 0 ? (
        <p className="text-muted text-sm">
          Aún no tienes passkeys. Añade una para iniciar sesión sin contraseña.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {passkeys.map((passkey) => (
            <li
              key={passkey.id}
              className="border-muted/20 flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <span>{passkey.name?.trim() || "Passkey sin nombre"}</span>
              <button
                type="button"
                onClick={() => handleDelete(passkey.id)}
                className="font-medium text-red-600"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
