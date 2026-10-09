import { expect, it } from "vitest";
import { z } from "zod";
import { blankable } from "@/lib/validation/util";
it("blankable", () => {
  const s = z.object({ a: blankable(z.coerce.number().int().min(1).max(9)), b: z.string() });
  expect(s.parse({ b: "x" })).toEqual({ a: null, b: "x" });
  expect(s.parse({ a: "", b: "x" })).toEqual({ a: null, b: "x" });
  expect(s.parse({ a: null, b: "x" })).toEqual({ a: null, b: "x" });
  expect(s.parse({ a: "5", b: "x" })).toEqual({ a: 5, b: "x" });
  expect(s.safeParse({ a: "50", b: "x" }).success).toBe(false);
});
