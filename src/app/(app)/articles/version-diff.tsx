import Link from "next/link";
import { diffLines } from "diff";

/**
 * Vista de versiones de un artículo revisado: enlace al original, revisiones posteriores y
 * un diff por líneas del Markdown (verde = añadido, rojo = eliminado). Se calcula en el
 * servidor con `diff` (jsdiff): el Markdown de un artículo es pequeño y el resultado se
 * renderiza estático, sin JS en el cliente.
 */
export function VersionDiff({
  parent,
  currentMarkdown,
  revisions,
}: {
  parent: { id: string; title: string; contentMarkdown: string } | null;
  currentMarkdown: string;
  /** Revisiones posteriores (hijos) de este artículo. */
  revisions: { id: string; title: string; createdAt: Date }[];
}) {
  if (!parent && revisions.length === 0) return null;

  const parts = parent ? diffLines(parent.contentMarkdown, currentMarkdown) : [];
  const hasChanges = parts.some((part) => part.added || part.removed);

  return (
    <section className="border-muted/15 bg-foreground/[0.02] flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">Versiones</h2>

      {parent ? (
        <p className="text-sm">
          Este artículo es una revisión de{" "}
          <Link href={`/articles/${parent.id}`} className="text-primary underline">
            {parent.title}
          </Link>
          .
        </p>
      ) : null}

      {revisions.length > 0 ? (
        <div className="text-sm">
          <p className="font-medium">Revisiones posteriores:</p>
          <ul className="list-inside list-disc">
            {revisions.map((child) => (
              <li key={child.id}>
                <Link href={`/articles/${child.id}`} className="text-primary underline">
                  {child.title}
                </Link>{" "}
                <span className="text-muted text-xs">
                  ({new Date(child.createdAt).toLocaleDateString("es-ES")})
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {parent ? (
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            Diferencias con la versión original{hasChanges ? "" : " (sin cambios)"}
          </summary>
          <pre className="mt-2 max-h-96 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
            {parts.map((part, index) => (
              <span
                key={index}
                className={
                  part.added
                    ? "bg-green-100 text-green-900"
                    : part.removed
                      ? "bg-red-100 text-red-900 line-through"
                      : "text-muted"
                }
              >
                {part.value}
              </span>
            ))}
          </pre>
        </details>
      ) : null}
    </section>
  );
}
