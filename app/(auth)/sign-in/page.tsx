import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountForm } from "@/components/auth/account-form";
import { getSession } from "@/lib/auth/session";
import { features } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  if (await getSession()) redirect("/today");
  const justReset = (await searchParams).reset === "1";
  return (
    <>
      {justReset ? (
        <p role="status" className="mb-5 border-l-2 border-good py-1 pl-3 text-sm">
          Your password has been changed. Sign in with the new one.
        </p>
      ) : null}
      <AccountForm mode="sign-in" google={features.google} passwordReset={features.passwordReset} />
    </>
  );
}
