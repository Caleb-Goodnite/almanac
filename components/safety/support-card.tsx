import { CRISIS_SUPPORT, EATING_SUPPORT, SUPPORT_MESSAGE, type Resource } from "@/lib/safety/resources";

function ResourceList({ items }: { items: readonly Resource[] }) {
  return (
    <ul>
      {items.map((r) => (
        <li key={r.name} className="border-b border-rule py-3">
          <p className="font-medium">
            <a href={r.href} rel="noopener noreferrer" target="_blank" className="underline underline-offset-4">
              {r.name}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
          <p className="nums font-display text-xl">{r.contact}</p>
          <p className="text-sm text-ink-soft">{r.detail}</p>
        </li>
      ))}
    </ul>
  );
}

/** Supportive, non-judgmental messaging with real places to turn. Used on /support and in the coach. */
export function SupportCard({ isTeen, compact = false }: { isTeen: boolean; compact?: boolean }) {
  return (
    <div>
      <h2 className="font-display text-2xl">{SUPPORT_MESSAGE.heading}</h2>
      <p className="mt-2 max-w-prose leading-relaxed text-ink-soft">{SUPPORT_MESSAGE.body}</p>
      <p className="mt-2 max-w-prose leading-relaxed text-ink-soft">{isTeen ? SUPPORT_MESSAGE.teenExtra : SUPPORT_MESSAGE.adultExtra}</p>
      <h3 className="label mt-6">Eating and body image</h3>
      <ResourceList items={EATING_SUPPORT} />
      {!compact ? (
        <>
          <h3 className="label mt-6">If you are in crisis or thinking about harming yourself</h3>
          <ResourceList items={CRISIS_SUPPORT} />
        </>
      ) : null}
      <p className="mt-4 text-sm text-ink-soft">
        These are services in the United States. If you are elsewhere, your doctor or local
        health service can point you to help near you. In an emergency, call your local
        emergency number.
      </p>
    </div>
  );
}
