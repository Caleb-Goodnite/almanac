import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { clearAge } from "@/app/(auth)/actions";
import { AccountForm } from "@/components/auth/account-form";
import { DobForm } from "@/components/auth/dob-form";
import { AGE_BLOCK_COOKIE, AGE_OK_COOKIE, verifyAgeToken } from "@/lib/auth/age-gate";
import { getSession } from "@/lib/auth/session";
import { ensureProfile } from "@/lib/data/profile";
import { features } from "@/lib/env";
import { isNativeApp } from "@/lib/utils/native-app";
import { regionAllowed } from "@/lib/safety/region";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const session = await getSession();
  const jar = await cookies();
  const blocked = jar.has(AGE_BLOCK_COOKIE);
  const claim = verifyAgeToken(jar.get(AGE_OK_COOKIE)?.value);
  const { error } = await searchParams;

  if (session && !error) redirect("/today");
  // Signed in but sent back here: the account has no profile because it never
  // passed the gate. Once it has, finish setting it up.
  if (session && claim) {
    await ensureProfile(session.user.id, claim);
    redirect("/welcome");
  }

  if (!regionAllowed(await headers())) {
    return (
      <div>
        <h1 className="display text-3xl">Almanac is not available in your country yet</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          For now Almanac is only offered in the United States. Its guidance, age rules and
          support resources are written for there, and we would rather not offer it elsewhere
          than get those wrong.
        </p>
      </div>
    );
  }

  if (blocked) {
    return (
      <div>
        <h1 className="display text-3xl">Almanac is not available for you yet</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          You need to be at least 13 to use Almanac. We have not kept your date of birth or
          any other information about you.
        </p>
        <p className="mt-3 leading-relaxed text-ink-soft">
          If you want to learn about eating well and staying active, a parent, a school nurse
          or your doctor is a good person to ask.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          If the date you entered was a mistake, sign-up opens again here in 24 hours.
        </p>
      </div>
    );
  }

  if (!claim) {
    return (
      <div>
        {error ? (
          <p role="status" className="mb-5 border-l-2 border-accent py-1 pl-3 text-sm text-ink-soft">
            Before creating an account we need your date of birth.
          </p>
        ) : null}
        <DobForm />
        <p className="mt-6 text-sm text-ink-soft">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-ink underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <AccountForm mode="sign-up" google={features.google && !(await isNativeApp())} />
      <form action={clearAge} className="mt-2">
        <button type="submit" className="label min-h-11 underline decoration-dotted underline-offset-4 hover:text-ink">
          Entered the wrong birth date?
        </button>
      </form>
    </div>
  );
}
