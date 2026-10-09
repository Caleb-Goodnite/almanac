import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountForm } from "@/components/auth/account-form";
import { getSession } from "@/lib/auth/session";
import { features } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await getSession()) redirect("/today");
  return <AccountForm mode="sign-in" google={features.google} />;
}
