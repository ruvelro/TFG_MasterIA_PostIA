"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { OpenRouterModel } from "@/lib/ai/openrouter-models";

/**
 * Selector de modelo de OpenRouter con filtrado incremental. Reemplaza al antiguo input de
 * texto libre: el `<input>` sigue llamándose "model" para que el Server Action `saveStepConfig`
 * no cambie, pero ahora muestra un desplegable con el catálogo real que se filtra al escribir.
 *
 * Se conserva la posibilidad de teclear un id arbitrario (modelos nuevos o no listados): la
 * lista solo sugiere; no restringe. Si el catálogo no carga (fallo de red), el campo degrada a
 * un input de texto normal, así que el panel nunca queda inservible.
 */

// Máximo de opciones renderizadas a la vez: el catálogo tiene cientos de modelos y pintar todos
// es innecesario. El filtrado por texto reduce el conjunto rápidamente hasta lo relevante.
const MAX_VISIBLE = 50;

/**
 * Caché a nivel de módulo: la página monta un combobox por cada etapa de IA (9). Compartir una
 * única promesa evita 9 peticiones idénticas a nuestra ruta interna al abrir el panel.
 */
let modelsPromise: Promise<OpenRouterModel[]> | null = null;

function loadModels(): Promise<OpenRouterModel[]> {
  if (!modelsPromise) {
    modelsPromise = fetch("/api/admin/openrouter-models", {
      headers: { Accept: "application/json" },
    })
      .then((res) => (res.ok ? res.json() : { models: [] }))
      .then((data: { models?: OpenRouterModel[] }) => data.models ?? [])
      .catch(() => {
        // Se resetea para permitir un reintento en el siguiente montaje/foco.
        modelsPromise = null;
        return [];
      });
  }
  return modelsPromise;
}

export function ModelCombobox({
  name,
  defaultValue,
  className,
}: {
  name: string;
  defaultValue: string;
  className?: string;
}) {
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    let alive = true;
    void loadModels().then((list) => {
      if (alive) setModels(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Cierra el desplegable al hacer clic fuera del componente.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? models.filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
      : models;
    return matches.slice(0, MAX_VISIBLE);
  }, [models, query]);

  function select(model: OpenRouterModel) {
    setQuery(model.id);
    setOpen(false);
    setActiveIndex(-1);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      if (open && activeIndex >= 0 && activeIndex < filtered.length) {
        event.preventDefault();
        select(filtered[activeIndex]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        name={name}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        value={query}
        placeholder="p. ej. google/gemini-2.5-flash"
        className={className}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />

      {open && filtered.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="border-muted/30 bg-background absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border shadow-lg"
        >
          {filtered.map((model, index) => {
            const isActive = index === activeIndex;
            return (
              <li
                key={model.id}
                role="option"
                aria-selected={isActive}
                // onMouseDown (no onClick) para seleccionar ANTES de que el input pierda el foco.
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(model);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`cursor-pointer px-3 py-2 text-sm ${isActive ? "bg-primary/10" : ""}`}
              >
                <span className="font-mono">{model.id}</span>
                {model.name && model.name !== model.id ? (
                  <span className="text-muted ml-2 text-xs">{model.name}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
