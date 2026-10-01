import { describe, expect, it } from "vitest";
import { mergeStaffRecipients } from "./staff-recipients";

describe("mergeStaffRecipients", () => {
  it("puts the owner inbox first and appends admins", () => {
    expect(mergeStaffRecipients("owner@x.com", ["a@x.com", "b@x.com"])).toEqual([
      "owner@x.com",
      "a@x.com",
      "b@x.com",
    ]);
  });

  it("de-duplicates case-insensitively and trims", () => {
    expect(mergeStaffRecipients(" Owner@X.com ", ["owner@x.com", "A@x.com", "a@x.com "])).toEqual([
      "owner@x.com",
      "a@x.com",
    ]);
  });

  it("drops empty and malformed entries", () => {
    expect(mergeStaffRecipients(undefined, [null, "", "not-an-email", "ok@x.com"])).toEqual([
      "ok@x.com",
    ]);
  });

  it("returns an empty list when nothing is configured", () => {
    expect(mergeStaffRecipients("", [])).toEqual([]);
  });
});
