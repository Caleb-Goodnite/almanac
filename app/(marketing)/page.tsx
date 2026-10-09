import { ButtonLink } from "@/components/ui/button";

export default function Home() {
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
        <ButtonLink href="/styleguide" size="lg">
          View the style guide
        </ButtonLink>
      </div>
    </main>
  );
}
