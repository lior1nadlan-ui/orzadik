import { describe, it, expect } from "vitest";
import { AUDIENCE_SEGMENTS, filterAudience, segmentLabel } from "./campaign-audience";

const audience = [
  { email: "buyer@example.com", name: "א" },
  { email: "member@example.com", name: "ב" },
  { email: "both@example.com", name: "ג" },
  { email: "reader@example.com", name: "ד" },
];
const ctx = {
  paidEmails: new Set(["buyer@example.com", "both@example.com", "stranger@example.com"]),
  memberEmails: new Set(["member@example.com", "both@example.com"]),
};
const emails = (s: Parameters<typeof filterAudience>[1]) =>
  filterAudience(audience, s, ctx).map((r) => r.email);

describe("campaign audience segments", () => {
  it("sends 'all' to everyone who consented, unchanged", () => {
    expect(emails("all")).toHaveLength(4);
  });

  it("splits buyers from non-buyers with no overlap and nothing lost", () => {
    const buyers = emails("buyers");
    const non = emails("non_buyers");
    expect(buyers).toEqual(["buyer@example.com", "both@example.com"]);
    expect(non).toEqual(["member@example.com", "reader@example.com"]);
    expect(buyers.length + non.length).toBe(audience.length);
  });

  it("never adds an address that was not in the consented list", () => {
    // stranger@ paid but never opted in to marketing.
    expect(emails("buyers")).not.toContain("stranger@example.com");
  });

  it("finds club members", () => {
    expect(emails("members")).toEqual(["member@example.com", "both@example.com"]);
  });

  it("has a Hebrew label for every segment", () => {
    for (const s of AUDIENCE_SEGMENTS) expect(segmentLabel(s.key)).toMatch(/[א-ת]/);
  });
});
