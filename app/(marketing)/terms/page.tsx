import type { Metadata } from "next";
import Link from "next/link";
import { Clause, LegalPage, operator } from "@/components/legal";
import { DISCLAIMER } from "@/components/ui/disclaimer";

export const metadata: Metadata = { title: "Terms", description: "The terms for using Almanac." };

export default function TermsPage() {
  const op = operator();
  return (
    <LegalPage title="Terms of use" updated="October 2026">
      <Clause title="What Almanac is">
        <p>Almanac is a tool for recording what you eat, how you train, and how you sleep and recover, and for seeing general, research-based guidance about those things. It is run by {op.name}.</p>
      </Clause>

      <Clause title="Not medical advice">
        <p>{DISCLAIMER}</p>
        <p>
          The AI coach is a computer program. It can be wrong, it does not know your medical history, and it is not a doctor,
          dietitian or therapist. Do not rely on it in an emergency. If you are in crisis, call your local emergency number or
          see the Support page in the app.
        </p>
        <p>Calorie, energy and heart-rate figures are estimates. They can be off by a meaningful amount for any one person.</p>
      </Clause>

      <Clause title="Who can use it">
        <ul>
          <li>You must be at least 13 years old.</li>
          <li>Almanac is currently offered only in the United States.</li>
          <li>If you are under 18, you should have a parent or guardian’s permission, and we encourage you to use it with them.</li>
          <li>You must give your real date of birth. It decides which safety limits apply to you.</li>
        </ul>
      </Clause>

      <Clause title="Your account">
        <p>Keep your password private and tell us if you think someone else has used your account. You are responsible for what is logged under it.</p>
      </Clause>

      <Clause title="Using it fairly">
        <ul>
          <li>Do not try to access other people’s data, overload the service, or get around its limits.</li>
          <li>Do not use the coach to get advice on harming yourself or anyone else, or to work around its safety limits.</li>
          <li>The coach has a daily message limit, which we may change.</li>
        </ul>
      </Clause>

      <Clause title="Your data">
        <p>What you log is yours. You can download or delete it at any time. How we handle it is described on the <Link href="/privacy">Privacy page</Link>.</p>
      </Clause>

      <Clause title="Changes and availability">
        <p>We may change or stop offering Almanac. If we plan to shut it down, we will give notice in the app so you can download your data first.</p>
      </Clause>

      <Clause title="Liability">
        <p>
          Almanac is provided as it is, without guarantees that it is accurate, complete or always available. The wording of
          this section in particular needs a lawyer before launch, because what can and cannot be limited depends on where
          you live.
        </p>
      </Clause>
    </LegalPage>
  );
}
