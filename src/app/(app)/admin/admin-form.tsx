"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { AdminActionState } from "./actions";

/**
 * Botón de envío con indicador de estado a su derecha. Vive DENTRO del `<form>` para poder leer
 * `useFormStatus` (estado de envío en curso). El mensaje de resultado ("Guardado ✓" / error) lo
 * recibe del padre, que es quien tiene el estado de `useActionState`.
 */
function SaveButton({ label, state }: { label: string; state: AdminActionState | null }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="bg-primary self-start rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Guardando…" : label}
      </button>
      {!pending && state ? (
        <span className={`text-sm ${state.ok ? "text-green-600" : "text-red-600"}`} role="status">
          {state.ok ? `${state.message} ✓` : state.message}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Envoltorio cliente para los formularios del panel que usan Server Actions. Conecta la acción con
 * `useActionState` para mostrar realimentación de guardado sin recargar la página. Los campos del
 * formulario se pasan como `children` (server-rendered); aquí solo se añade el botón con estado.
 */
export function AdminForm({
  action,
  label,
  children,
  className = "flex flex-col gap-4",
}: {
  action: (prev: AdminActionState | null, formData: FormData) => Promise<AdminActionState>;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <SaveButton label={label} state={state} />
    </form>
  );
}
