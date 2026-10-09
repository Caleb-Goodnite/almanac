import type { Metadata } from "next";
import { Revoke } from "@/components/guardian/revoke";
import { findRevocable } from "@/lib/data/guardian";

export const metadata: Metadata = { title: "Withdraw approval" };

export default async function RevokePage({ params }: PageProps<"/guardian/revoke/[token]">) {
  const { token } = await params;
  const found = await findRevocable(token);

  if (!found) {
    return (
      <>
        <h1 className="display text-4xl">Nothing to withdraw</h1>
        <p className="mt-4 max-w-prose leading-relaxed text-ink-soft">
          This link is not valid, or the approval has already been withdrawn.
        </p>
      </>
    );
  }
  return <Revoke token={token} firstName={found.firstName} />;
}
