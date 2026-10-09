import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import type { ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const metadata: Metadata = {
  title: "Research",
  description: "The published evidence behind every formula, default and limit in Almanac.",
};

/**
 * Renders docs/RESEARCH.md, the single source of truth for the evidence.
 * Headings in the file carry anchors as `<a id="x"></a>`; raw HTML is not
 * rendered, so the anchor is lifted into the heading's id here.
 */
function prepare(source: string): string {
  return source.replace(/^(#{2,3}) <a id="([a-z-]+)"><\/a>(.*)$/gm, "$1 $3 {#$2}");
}

function splitAnchor(children: ReactNode): { id?: string; content: ReactNode } {
  const list = Array.isArray(children) ? children : [children];
  const last = list[list.length - 1];
  if (typeof last === "string") {
    const m = /^(.*?)\s*\{#([a-z-]+)\}$/.exec(last);
    if (m) return { id: m[2], content: [...list.slice(0, -1), m[1]] };
  }
  return { content: children };
}

export default async function ResearchPage() {
  const source = await readFile(path.join(process.cwd(), "docs/RESEARCH.md"), "utf8");

  return (
    <main id="main" className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
      <Link href="/" className="label hover:text-ink">
        Almanac
      </Link>
      <article className="mt-6">
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => <h1 className="display mb-6 text-5xl sm:text-7xl">{children}</h1>,
            h2: ({ children }) => {
              const { id, content } = splitAnchor(children);
              return (
                <h2 id={id} className="masthead-rule display mt-14 mb-4 scroll-mt-6 text-3xl">
                  {content}
                </h2>
              );
            },
            h3: ({ children }) => {
              const { id, content } = splitAnchor(children);
              return (
                <h3 id={id} className="mt-8 mb-3 scroll-mt-6 font-display text-xl">
                  {content}
                </h3>
              );
            },
            p: ({ children }) => <p className="my-3 max-w-prose leading-relaxed text-ink-soft">{children}</p>,
            ul: ({ children }) => <ul className="my-3 list-disc space-y-1.5 pl-5 text-ink-soft">{children}</ul>,
            ol: ({ children }) => <ol className="my-3 list-decimal space-y-2 pl-6 text-sm leading-relaxed text-ink-soft">{children}</ol>,
            a: ({ href, children }) => (
              <a href={href} className="text-ink underline underline-offset-4 [overflow-wrap:anywhere]">
                {children}
              </a>
            ),
            strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
            code: ({ children }) => <code className="nums rounded-[2px] bg-paper-sunk px-1 py-0.5 font-mono text-[0.85em] text-ink">{children}</code>,
            hr: () => <hr className="my-10 border-rule" />,
            table: ({ children }) => (
              <div className="my-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Evidence table">
                <table className="w-full min-w-[40rem] border-collapse text-left text-sm">{children}</table>
              </div>
            ),
            th: ({ children }) => <th className="label border-b border-ink py-2 pr-4 align-bottom font-normal">{children}</th>,
            td: ({ children }) => <td className="border-b border-rule py-3 pr-4 align-top leading-relaxed text-ink-soft first:font-medium first:text-ink">{children}</td>,
          }}
        >
          {prepare(source)}
        </Markdown>
      </article>
    </main>
  );
}
