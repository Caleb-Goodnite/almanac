import Link from "next/link";
import { Providers } from "@/components/providers";
import { Nav } from "@/components/shell/nav";
import { OfflineBanner } from "@/components/shell/offline-banner";
import { Disclaimer } from "@/components/ui/disclaimer";
import { requireViewer } from "@/lib/auth/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Every page under this layout also checks the session itself before
  // reading data; this call only handles the redirects in one place.
  await requireViewer();

  return (
    <Providers>
    <div className="flex flex-1 flex-col md:flex-row">
      <Nav />
      <div className="flex min-w-0 flex-1 flex-col pb-24 md:pb-0">
        <OfflineBanner />
        {/* At least a screen tall, so the footer never jumps into view while a page streams in. */}
        <main id="main" className="mx-auto min-h-dvh w-full max-w-3xl flex-1 px-5 py-6 sm:px-8 md:py-10">
          {children}
        </main>
        <footer className="mx-auto w-full max-w-3xl border-t border-rule px-5 py-5 sm:px-8">
          <Disclaimer className="text-xs leading-relaxed text-ink-soft" />
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
            <Link href="/research" className="underline underline-offset-4 hover:text-ink">
              The research behind the numbers
            </Link>
            <Link href="/settings" className="underline underline-offset-4 hover:text-ink">
              Settings and your data
            </Link>
            <Link href="/privacy" className="underline underline-offset-4 hover:text-ink">
              Privacy
            </Link>
            <Link href="/terms" className="underline underline-offset-4 hover:text-ink">
              Terms
            </Link>
          </p>
        </footer>
      </div>
    </div>
    </Providers>
  );
}
