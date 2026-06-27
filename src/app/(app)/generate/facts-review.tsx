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

// Pantalla de revisión humana: el usuario valida o matiza los hechos extraídos (añadir,
// editar o eliminar) antes de que el pipeline redacte el artículo. Los hechos se muestran
// agrupados por la URL de la que provienen para revisarlos de forma ordenada.
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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Revisa los datos extraídos</h2>
        <p className="text-muted text-sm">
          Estos hechos son la fuente de verdad del artículo, agrupados por su fuente. Edítalos,
          elimínalos o añade otros.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <fieldset
            key={group.id}
            className="border-muted/20 flex flex-col gap-3 rounded-md border p-3"
          >
            <div className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-1 text-sm">
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
              <button
                type="button"
                onClick={() => removeGroup(group.id)}
                className="shrink-0 px-1 pb-2 text-xs font-medium text-red-600"
              >
                Eliminar fuente
              </button>
            </div>

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
                    className="shrink-0 px-1 pt-2 text-xs font-medium text-red-600"
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => addClaim(group.id)}
              className="border-muted/30 self-start rounded-md border px-3 py-1.5 text-xs font-medium"
            >
              Añadir hecho a esta fuente
            </button>
          </fieldset>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={addGroup}
          className="border-muted/30 rounded-md border px-3 py-2 text-sm font-medium"
        >
          Añadir fuente
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={disabled}
          className="bg-primary rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Continuar y redactar
        </button>
      </div>
    </div>
  );
}
