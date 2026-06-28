"use client";

import { useState } from "react";

import type { Facts } from "@/lib/pipeline/schemas";

const inputClass =
  "border-muted/30 focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none";

interface ClaimItem {
  id: string;
  claim: string;
}

/** Grupo de hechos que comparten la misma fuente (URL). La fuente se edita a nivel de grupo. */
interface SourceGroup {
  id: string;
  source: string;
  claims: ClaimItem[];
}

function uid(): string {
  return crypto.randomUUID();
}

/** Etiqueta legible de la fuente: el dominio si es una URL válida, o el texto tal cual. */
function sourceLabel(source: string): string {
  try {
    return new URL(source).hostname.replace(/^www\./, "");
  } catch {
    return source.trim() || "Fuente sin URL";
  }
}

/**
 * Agrupa los hechos extraídos por su URL de origen, preservando el orden de primera aparición.
 * Es más legible revisar "una fuente y todos sus datos" que una lista plana de hechos sueltos.
 */
function groupBySource(facts: Facts): SourceGroup[] {
  const groups: SourceGroup[] = [];
  const bySource = new Map<string, SourceGroup>();
  for (const fact of facts.facts) {
    let group = bySource.get(fact.source);
    if (!group) {
      group = { id: uid(), source: fact.source, claims: [] };
      bySource.set(fact.source, group);
      groups.push(group);
    }
    group.claims.push({ id: uid(), claim: fact.claim });
  }
  return groups;
}

// Pantalla de revisión humana: el usuario valida o matiza los hechos extraídos antes de redactar.
// Las fuentes se muestran PLEGADAS (acordeón) para escanearlas de un vistazo, y la acción de
// continuar vive en una BARRA FIJA siempre visible: así no hay que adivinar que se debe bajar.
export function FactsReview({
  initialFacts,
  disabled,
  onContinue,
}: {
  initialFacts: Facts;
  disabled: boolean;
  onContinue: (facts: Facts) => void;
}) {
  const [groups, setGroups] = useState<SourceGroup[]>(() => groupBySource(initialFacts));

  function patchGroup(groupId: string, change: Partial<SourceGroup>) {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, ...change } : g)));
  }

  function updateClaim(groupId: string, claimId: string, value: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, claims: g.claims.map((c) => (c.id === claimId ? { ...c, claim: value } : c)) }
          : g,
      ),
    );
  }

  function removeClaim(groupId: string, claimId: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, claims: g.claims.filter((c) => c.id !== claimId) } : g,
      ),
    );
  }

  function addClaim(groupId: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, claims: [...g.claims, { id: uid(), claim: "" }] } : g,
      ),
    );
  }

  function removeGroup(groupId: string) {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  }

  function addGroup() {
    setGroups((prev) => [...prev, { id: uid(), source: "", claims: [{ id: uid(), claim: "" }] }]);
  }

  function handleContinue() {
    // Aplanamos de nuevo a la forma `Facts`, descartando hechos vacíos.
    const facts = groups.flatMap((group) =>
      group.claims
        .filter((c) => c.claim.trim().length > 0)
        .map((c) => ({ claim: c.claim, source: group.source })),
    );
    onContinue({ facts });
  }

  const totalClaims = groups.reduce(
    (n, g) => n + g.claims.filter((c) => c.claim.trim().length > 0).length,
    0,
  );
  const summary = `${groups.length} ${groups.length === 1 ? "fuente" : "fuentes"} · ${totalClaims} ${
    totalClaims === 1 ? "hecho" : "hechos"
  }`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Revisa los datos extraídos</h2>
        <p className="text-muted text-sm">
          Estos hechos son la fuente de verdad del artículo. Despliega una fuente para editar,
          eliminar o añadir hechos; o continúa directamente.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {groups.map((group) => (
          <details
            key={group.id}
            className="border-muted/20 hover:border-muted/40 group rounded-lg border transition-colors"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-3 p-3">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <span className="bg-primary/10 text-primary shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold">
                  {group.claims.length}
                </span>
                <span className="truncate font-medium">{sourceLabel(group.source)}</span>
              </span>
              <span className="text-muted shrink-0 text-lg leading-none transition-transform group-open:rotate-45">
                +
              </span>
            </summary>

            <div className="flex flex-col gap-3 p-3 pt-0">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted text-xs font-medium tracking-wide uppercase">
                  Fuente (URL)
                </span>
                <input
                  value={group.source}
                  onChange={(event) => patchGroup(group.id, { source: event.target.value })}
                  placeholder="https://…"
                  className={`${inputClass} font-mono`}
                />
              </label>

              <ul className="flex flex-col gap-2">
                {group.claims.map((item) => (
                  <li key={item.id} className="flex items-start gap-2">
                    <textarea
                      value={item.claim}
                      onChange={(event) => updateClaim(group.id, item.id, event.target.value)}
                      placeholder="Hecho"
                      rows={2}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => removeClaim(group.id, item.id)}
                      className="text-muted shrink-0 px-1 pt-2 text-xs font-medium hover:text-red-600"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => addClaim(group.id)}
                  className="border-muted/30 rounded-md border px-3 py-1.5 text-xs font-medium"
                >
                  Añadir hecho
                </button>
                <button
                  type="button"
                  onClick={() => removeGroup(group.id)}
                  className="text-xs font-medium text-red-600"
                >
                  Eliminar fuente
                </button>
              </div>
            </div>
          </details>
        ))}

        <button
          type="button"
          onClick={addGroup}
          className="border-muted/30 self-start rounded-md border px-3 py-2 text-sm font-medium"
        >
          Añadir fuente
        </button>
      </div>

      {/* Barra de acción fija: el botón de continuar nunca se esconde, esté donde esté el scroll. */}
      <div className="border-muted/20 bg-background/90 sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t py-3 backdrop-blur">
        <span className="text-muted text-sm">{summary}</span>
        <button
          type="button"
          onClick={handleContinue}
          disabled={disabled}
          className="bg-primary rounded-md px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          Continuar y redactar
        </button>
      </div>
    </div>
  );
}
