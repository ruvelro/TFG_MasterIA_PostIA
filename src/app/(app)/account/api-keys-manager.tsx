"use client";

import { useEffect, useState } from "react";

const inputClass =
  "border-muted/30 focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none";

interface ApiKeyDto {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/**
 * Gestión de claves de la API pública. La clave en claro se muestra UNA sola vez, justo
 * al crearla (después solo existe su hash en el servidor): el aviso lo deja claro.
 */
export function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKeyDto[]>([]);
  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/account/api-keys").then(async (response) => {
      if (response.ok && active) setKeys((await response.json()) as ApiKeyDto[]);
    });
    return () => {
      active = false;
    };
  }, []);

  async function refresh() {
    const response = await fetch("/api/account/api-keys");
    if (response.ok) setKeys((await response.json()) as ApiKeyDto[]);
  }

  async function create() {
    setBusy(true);
    setError(null);
    setCreatedKey(null);
    try {
      const response = await fetch("/api/account/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        setError(await response.text());
        return;
      }
      const created = (await response.json()) as { plaintext: string };
      setCreatedKey(created.plaintext);
      setName("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    await fetch(`/api/account/api-keys/${id}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">Claves de API</h2>
        <p className="text-muted text-sm">
          Para usar la API pública (<code>POST /api/v1/generate</code> con{" "}
          <code>Authorization: Bearer &lt;clave&gt;</code>). Tus límites de tasa y presupuesto
          aplican igual que en la web.
        </p>
      </div>

      {createdKey ? (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          <p className="font-medium">Clave creada. Cópiala ahora: no se volverá a mostrar.</p>
          <code className="mt-1 block break-all select-all">{createdKey}</code>
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Nombre de la clave</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="p. ej. Integración con mi CMS"
            className={inputClass}
          />
        </label>
        <button
          type="button"
          onClick={create}
          disabled={busy || name.trim().length === 0}
          className="bg-primary rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Crear clave
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">Error: {error}</p> : null}

      {keys.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm">
          {keys.map((key) => (
            <li key={key.id} className="flex items-center justify-between gap-2">
              <span>
                <span className="font-medium">{key.name}</span>{" "}
                <code className="text-muted text-xs">{key.prefix}…</code>
                {key.revokedAt ? <span className="ml-2 text-xs text-red-600">revocada</span> : null}
              </span>
              {!key.revokedAt ? (
                <button
                  type="button"
                  onClick={() => revoke(key.id)}
                  className="text-xs font-medium text-red-600"
                >
                  Revocar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted text-sm">Aún no tienes claves.</p>
      )}
    </section>
  );
}
