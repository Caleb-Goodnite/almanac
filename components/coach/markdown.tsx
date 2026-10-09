import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders the coach's markdown. Raw HTML is never rendered (react-markdown
 * ignores it by default), images are dropped, and links are limited to our
 * own pages and https, opening external ones in a new tab.
 */
export function CoachMarkdown({ children }: { children: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      allowedElements={["p", "strong", "em", "ul", "ol", "li", "a", "code", "blockquote", "br", "table", "thead", "tbody", "tr", "th", "td", "h3", "h4", "hr"]}
      unwrapDisallowed
      components={{
        p: ({ children }) => <p className="my-2.5 leading-relaxed first:mt-0 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        ul: ({ children }) => <ul className="my-2.5 list-disc space-y-1.5 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="my-2.5 list-decimal space-y-1.5 pl-5">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        h3: ({ children }) => <p className="mt-4 mb-1 font-semibold">{children}</p>,
        h4: ({ children }) => <p className="mt-4 mb-1 font-semibold">{children}</p>,
        blockquote: ({ children }) => <blockquote className="my-2.5 border-l-2 border-rule-strong pl-3 text-ink-soft">{children}</blockquote>,
        code: ({ children }) => <code className="nums font-mono text-[0.9em]">{children}</code>,
        hr: () => <hr className="my-4 border-rule" />,
        table: ({ children }) => (
          <div className="my-3 overflow-x-auto">
            <table className="nums w-full border-collapse text-left text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="border-b border-ink py-1.5 pr-3 font-medium">{children}</th>,
        td: ({ children }) => <td className="border-b border-rule py-1.5 pr-3 align-top">{children}</td>,
        a: ({ href, children }) => {
          if (href?.startsWith("/")) {
            return (
              <Link href={href} className="underline underline-offset-4">
                {children}
              </Link>
            );
          }
          if (href?.startsWith("https://")) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">
                {children}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            );
          }
          return <>{children}</>;
        },
      }}
    >
      {children}
    </Markdown>
  );
}
