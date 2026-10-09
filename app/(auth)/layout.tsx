import Link from "next/link";
import { Disclaimer } from "@/components/ui/disclaimer";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto grid w-full max-w-5xl flex-1 gap-10 px-5 py-8 sm:px-8 md:grid-cols-[1fr_minmax(0,26rem)] md:items-center md:gap-16 md:py-16">
      <div>
        <Link href="/" className="label hover:text-ink">
          Almanac
        </Link>
        <p className="display mt-4 text-5xl md:text-7xl">
          Keep a calm record<span className="text-accent">.</span>
        </p>
        <p className="mt-5 hidden max-w-md leading-relaxed text-ink-soft md:block">
          Food, training, sleep and weight in one place, with targets that come from published
          research and a coach that reads your real numbers.
        </p>
      </div>
      <main id="main" className="masthead-rule">
        {children}
        <footer className="mt-10 border-t border-rule pt-4">
          <Disclaimer className="text-xs leading-relaxed text-ink-soft" />
        </footer>
      </main>
    </div>
  );
}
