import type { Metadata } from "next";
import Link from "next/link";
import { Clause, LegalPage, operator } from "@/components/legal";

export const metadata: Metadata = { title: "Privacy", description: "What Almanac collects, why, who sees it, and how to delete it." };

export default function PrivacyPage() {
  const op = operator();
  return (
    <LegalPage title="Privacy" updated="October 2026">
      <Clause title="The short version">
        <ul>
          <li>Almanac stores what you type into it so it can show it back to you and work out your targets.</li>
          <li>We do not sell your data, show ads, or use tracking or analytics tools.</li>
          <li>You can download everything or delete your account at any time in Settings.</li>
          <li>You must be 13 or older, and Almanac is currently offered only in the United States.</li>
        </ul>
      </Clause>

      <Clause title="Who runs Almanac">
        <p>
          Almanac is run by {op.name}.{" "}
          {op.contact ? (
            <>
              Questions about your data: <a href={`mailto:${op.contact}`}>{op.contact}</a>.
            </>
          ) : (
            "A contact address will be listed here before launch."
          )}
        </p>
      </Clause>

      <Clause title="What we collect">
        <ul>
          <li><strong>Account:</strong> your email address, first name, and a scrambled (hashed) form of your password. If you sign in with Google, Google tells us your name and email.</li>
          <li><strong>Age:</strong> the month and year you were born. We ask for the full date once to check you are 13 or older, and we do not keep the day.</li>
          <li><strong>Profile:</strong> height, sex if you choose to give it, your goal and activity level.</li>
          <li><strong>What you log:</strong> food and water, workouts, weight and measurements, sleep, mood, energy, soreness and resting heart rate. This is information about your health.</li>
          <li><strong>Coach conversations:</strong> the messages you send and the replies.</li>
          <li><strong>Guardian approval (under-18s only):</strong> if you ask a parent or guardian to approve a fat-loss goal, we keep the email address you give for them, and, if they approve, their name, their relationship to you and the date.</li>
          <li><strong>Sign-in records:</strong> your IP address and browser type, kept with your session for security.</li>
        </ul>
        <p>We do not collect your precise location, contacts or photos. The barcode scanner uses your camera only inside your browser; images are not uploaded.</p>
        <p>If you are under 13 we do not create an account and do not keep your date of birth. A cookie remembers for one day that this browser was turned away.</p>
      </Clause>

      <Clause title="How we use it">
        <ul>
          <li>To show you your own logs, trends and targets.</li>
          <li>To calculate targets and safety limits (see <Link href="/research">the research page</Link>).</li>
          <li>To answer you in the coach and write your weekly review.</li>
          <li>To keep accounts secure and prevent abuse.</li>
        </ul>
        <p>We do not use your data for advertising or to train AI models.</p>
      </Clause>

      <Clause title="Who else handles your data">
        <ul>
          <li><strong>Our database host</strong> (Supabase) stores everything above on our behalf.</li>
          <li>
            <strong>The AI coach.</strong> When you use the coach, your message and a summary of your recent numbers (age band,
            goal, targets, averages and trends) are sent through OpenRouter to an AI model provider. Your name, email and birth
            date are never included. Requests are restricted to providers that do not keep prompts or train on them. For
            under-18s, weight figures are left out.
          </li>
          <li><strong>Food databases.</strong> When you search or scan, the search text or barcode goes to USDA FoodData Central or Open Food Facts. Nothing identifying you is sent.</li>
          <li><strong>Google,</strong> only if you choose to sign in with Google.</li>
          <li><strong>Our email provider</strong> (Resend), only to send a password-reset link you asked for.</li>
        </ul>
      </Clause>

      <Clause title="Cookies">
        <p>Almanac uses only the cookies it needs to work: one that keeps you signed in, one that remembers your light or dark theme, and short-lived ones for the age check. There are no advertising or analytics cookies.</p>
      </Clause>

      <Clause title="Your choices">
        <ul>
          <li><strong>Download:</strong> Settings, then “Download my data”, gives you a complete copy as a file.</li>
          <li><strong>Delete:</strong> Settings, then “Delete my account”, permanently removes your account and everything in it. Copies in our host’s routine backups expire on the host’s schedule.</li>
          <li><strong>Correct:</strong> you can edit or remove anything you have logged.</li>
        </ul>
      </Clause>

      <Clause title="If you are 13 to 17">
        <p>
          Almanac shows you different guidance from adults and applies stricter safety limits. If something you tell the coach
          suggests you are struggling with food or your body, it will show you support resources and switch your targets to
          maintenance. We encourage you to involve a parent or guardian in how you use the app.
        </p>
        <p>
          A fat-loss goal is locked until a parent or guardian approves it. You give us their email address; we send them one
          email with a link, showing your first name and nothing else from your account. If they approve, we send them a
          second email with a link they can use to withdraw the approval at any time. We cannot confirm who opens that email.
        </p>
      </Clause>

      <Clause title="How long we keep it">
        <p>Until you delete it or delete your account. Sign-in sessions expire after 30 days without use.</p>
      </Clause>

      <Clause title="Changes">
        <p>If we change how your data is handled, we will update this page and its date, and tell you in the app before a significant change takes effect.</p>
      </Clause>
    </LegalPage>
  );
}
