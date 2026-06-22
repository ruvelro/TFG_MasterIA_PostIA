import type { ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

// Render de Markdown SANEADO: `rehype-sanitize` elimina HTML peligroso del contenido
// generado por IA (defensa frente a XSS). Mapeamos las etiquetas a clases de Tailwind
// porque el preflight de Tailwind resetea los estilos por defecto de headings/listas.
const components: ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: (props) => <h1 className="mt-6 mb-2 text-2xl font-bold" {...props} />,
  h2: (props) => <h2 className="mt-5 mb-2 text-xl font-semibold" {...props} />,
  h3: (props) => <h3 className="mt-4 mb-1 text-lg font-semibold" {...props} />,
  p: (props) => <p className="my-3 leading-relaxed" {...props} />,
  ul: (props) => <ul className="my-3 list-disc pl-6" {...props} />,
  ol: (props) => <ol className="my-3 list-decimal pl-6" {...props} />,
  li: (props) => <li className="my-1" {...props} />,
  a: (props) => <a className="text-primary underline" {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  blockquote: (props) => (
    <blockquote className="border-muted/30 my-3 border-l-4 pl-4 italic" {...props} />
  ),
  code: (props) => <code className="bg-muted/10 rounded px-1 py-0.5 text-sm" {...props} />,
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
