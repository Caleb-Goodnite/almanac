import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Disclaimer } from "@/components/ui/disclaimer";
import { getSession } from "@/lib/auth/session";

export default async function Home() {
  if (await getSession()) redirect("/today");

  return (
    <main id="main" className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 py-16 sm:px-8">
      <p className="label">Vol. 1 · A daily record</p>
      <h1 className="display mt-4 text-[clamp(3.5rem,13vw,9rem)]">
        Almanac<span className="text-accent">.</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
        What you eat, how you train, and how you recover, kept in one calm place. Every
        target comes from published research, and the coach reads your real numbers.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href="/sign-up" size="lg">
          Get started
        </ButtonLink>
        <ButtonLink href="/sign-in" size="lg" variant="outline">
          Sign in
        </ButtonLink>
        <ButtonLink href="/research" size="lg" variant="quiet">
          Read the research
        </ButtonLink>
      </div>
      <footer className="mt-20 max-w-2xl border-t border-rule pt-4">
        <Disclaimer className="text-xs leading-relaxed text-ink-soft" />
        <p className="mt-2 flex gap-4 text-xs text-ink-soft">
          <Link href="/privacy" className="underline underline-offset-4 hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="underline underline-offset-4 hover:text-ink">
            Terms
          </Link>
        </p>
      </footer>
    </main>
  );
}
