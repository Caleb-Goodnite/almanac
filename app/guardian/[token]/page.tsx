import type { Metadata } from "next";
import { Approval } from "@/components/guardian/approval";
import { findGuardianRequest } from "@/lib/data/guardian";
import { MAX_DEFICIT_FRACTION, RATE_LIMITS } from "@/lib/safety/policy";
import { hashToken, issueStartStamp } from "@/lib/safety/guardian-token";
import { EATING_SUPPORT } from "@/lib/safety/resources";

export const metadata: Metadata = { title: "Guardian approval" };

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h1 className="display text-4xl">{title}</h1>
      <p className="mt-4 max-w-prose leading-relaxed text-ink-soft">{children}</p>
    </>
  );
}

export default async function GuardianPage({ params }: PageProps<"/guardian/[token]">) {
  const { token } = await params;
  const request = await findGuardianRequest(token);

  if (!request) {
    return <Notice title="This link is not valid">It may have been replaced by a newer request or cancelled. Nothing has been approved.</Notice>;
  }
  if (request.state === "expired") {
    return (
      <Notice title="This link has expired">
        Nothing has been approved. If {request.firstName} still wants this, they can send a new request from Settings in the app.
      </Notice>
    );
  }
  if (request.state === "approved") {
    return (
      <Notice title="Already approved">
        This request has been approved. To withdraw it, use the link in the confirmation email sent to this address.
      </Notice>
    );
  }
  if (request.state === "revoked") {
    return <Notice title="Approval withdrawn">This approval was withdrawn. {request.firstName}&apos;s targets are back to maintaining their weight.</Notice>;
  }
  if (request.state === "adult") {
    return <Notice title="No longer needed">{request.firstName} is now 18 and can choose their own goals.</Notice>;
  }

  return (
    <Approval
      token={token}
      stamp={issueStartStamp(hashToken(token))}
      firstName={request.firstName}
      limits={{
        maxLossPct: RATE_LIMITS.teen.maxLossPct,
        maxDeficitPct: MAX_DEFICIT_FRACTION.teen * 100,
      }}
      helplines={EATING_SUPPORT.map((r) => ({ name: r.name, contact: r.contact }))}
    />
  );
}
