import Link from "next/link";
import type { ReactNode } from "react";
import { env } from "@/lib/env";

export function operator() {
  return {
    name: env.OPERATOR_NAME ?? "the operator of this site",
    contact: env.CONTACT_EMAIL ?? null,
    configured: Boolean(env.OPERATOR_NAME && env.CONTACT_EMAIL),
  };
}

/** Shared frame for the privacy and terms pages, with a plain warning that they are drafts. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const op = operator();
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
      <Link href="/" className="label hover:text-ink">
        Almanac
      </Link>
      <h1 className="display mt-6 text-5xl sm:text-6xl">{title}</h1>
      <p className="label mt-3">Last updated {updated}</p>
      <p role="note" className="mt-6 border-l-2 border-accent py-1 pl-3 text-sm leading-relaxed">
        <strong className="font-semibold">Draft.</strong> This page describes what the app actually does, in plain
        language. It has not been reviewed by a lawyer and is not yet a binding legal document.
        {op.configured ? null : " The operator's name and contact address have not been filled in yet."}
      </p>
      <div className="legal mt-8 flex flex-col gap-8">{children}</div>
    </main>
  );
}

export function Clause({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="mt-2 flex max-w-prose flex-col gap-3 leading-relaxed text-ink-soft [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold [&_strong]:text-ink">
        {children}
      </div>
    </section>
  );
}
