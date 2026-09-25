// Who a mailing goes to, beyond "everyone who opted in".
//
// Consent is decided first and elsewhere (buildAudience in campaigns.functions:
// profile opt-in or an active newsletter subscription, minus suppressions and
// explicit refusals). A segment can only NARROW that list — it never adds an
// address that did not consent — so choosing one can never make a send less
// lawful than "all".
//
// Why segments at all: the three groups want different messages. A past buyer
// is told about the new tallit bags that match what they bought; someone who
// joined the club and never ordered needs a reason to make the first order; a
// member hears about member pricing. Sending all three the same email is what
// makes people unsubscribe.

export type AudienceSegment = "all" | "buyers" | "non_buyers" | "members";

export const AUDIENCE_SEGMENTS: { key: AudienceSegment; label: string; hint: string }[] = [
  { key: "all", label: "כל מאשרי הדיוור", hint: "כל מי שאישר לקבל דיוור." },
  { key: "buyers", label: "לקוחות שקנו", hint: "מאשרי דיוור עם לפחות הזמנה אחת ששולמה." },
  {
    key: "non_buyers",
    label: "טרם קנו",
    hint: "מאשרי דיוור שעוד לא השלימו הזמנה — מתאים להזמנה ראשונה.",
  },
  { key: "members", label: "חברי מועדון", hint: "מאשרי דיוור שהם חברי מועדון באתר." },
];

export function segmentLabel(s: AudienceSegment): string {
  return AUDIENCE_SEGMENTS.find((x) => x.key === s)?.label ?? s;
}

/** Narrow an already-consented audience to one segment. Emails are compared
 *  lowercased; the audience itself is assumed lowercased (buildAudience does). */
export function filterAudience<T extends { email: string }>(
  audience: T[],
  segment: AudienceSegment,
  ctx: { paidEmails: Set<string>; memberEmails: Set<string> },
): T[] {
  const key = (e: string) => e.trim().toLowerCase();
  switch (segment) {
    case "buyers":
      return audience.filter((r) => ctx.paidEmails.has(key(r.email)));
    case "non_buyers":
      return audience.filter((r) => !ctx.paidEmails.has(key(r.email)));
    case "members":
      return audience.filter((r) => ctx.memberEmails.has(key(r.email)));
    default:
      return audience;
  }
}
