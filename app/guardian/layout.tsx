import type { Metadata } from "next";
import Link from "next/link";
import { Disclaimer } from "@/components/ui/disclaimer";

// These pages are reached only from a private emailed link.
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function GuardianLayout({ children }: LayoutProps<"/guardian">) {
  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-5 py-8 sm:py-14">
      <Link href="/" className="label hover:text-ink">
        Almanac
      </Link>
      <main id="main" className="masthead-rule mt-4">
        {children}
        <footer className="mt-12 border-t border-rule pt-4">
          <Disclaimer className="text-xs leading-relaxed text-ink-soft" />
          <p className="mt-2 flex gap-4 text-xs text-ink-soft">
            <Link href="/privacy" className="underline underline-offset-4 hover:text-ink">
              Privacy
            </Link>
            <Link href="/research" className="underline underline-offset-4 hover:text-ink">
              Research
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
