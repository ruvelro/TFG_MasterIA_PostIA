"use client";

import { useState, type ReactNode } from "react";

export interface AdminTab {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Pestañas del panel de administración. Reduce el scroll vertical agrupando la configuración por
 * áreas. Recibe el contenido ya renderizado en el servidor (incluidos los formularios con Server
 * Action) y solo conmuta cuál se muestra en el cliente. La pestaña activa se conserva en estado
 * local; todas las secciones permanecen montadas (se ocultan con CSS) para no perder lo escrito
 * en un formulario al cambiar de pestaña.
 */
export function AdminTabs({ tabs }: { tabs: AdminTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  return (
    <div className="flex flex-col gap-6">
      <nav className="border-muted/20 flex flex-wrap gap-1 border-b" aria-label="Secciones">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              aria-current={isActive ? "page" : undefined}
              className={`-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm font-medium ${
                isActive
                  ? "border-primary text-primary"
                  : "text-muted hover:text-foreground border-transparent"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {tabs.map((tab) => (
        <div key={tab.id} hidden={tab.id !== active}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
