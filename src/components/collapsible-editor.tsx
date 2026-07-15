import type { ReactNode } from "react";

/** Panel nativo y accesible para editores extensos; empieza cerrado sin estado cliente adicional. */
export function CollapsibleEditor({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <details
      data-collapsible-editor
      className="border-muted/25 bg-background group overflow-hidden rounded-md border shadow-sm"
    >
      <summary className="hover:bg-muted/5 focus-visible:ring-primary marker:text-primary flex cursor-pointer items-center gap-3 px-4 py-3 marker:text-sm focus-visible:ring-2 focus-visible:outline-none">
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{title}</span>
          {description ? (
            <span className="text-muted mt-0.5 block truncate text-xs">{description}</span>
          ) : null}
        </span>
      </summary>
      <div className="border-muted/20 border-t px-4 py-4">{children}</div>
    </details>
  );
}
