import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-16">
      <p className="label">Page not found</p>
      <h1 className="display mt-3 text-6xl">
        Nothing on this page<span className="text-accent">.</span>
      </h1>
      <p className="mt-4 leading-relaxed text-ink-soft">The link may be old, or the entry may have been deleted.</p>
      <div className="mt-8">
        <ButtonLink href="/today">Go to Today</ButtonLink>
      </div>
    </main>
  );
}
