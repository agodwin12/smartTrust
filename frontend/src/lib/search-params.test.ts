import { describe, expect, it } from "vitest";
import { first, listingParams, toPage } from "./search-params";

describe("search params", () => {
  it("takes the first value of repeated keys", () => {
    expect(first(["a", "b"])).toBe("a");
    expect(first("x")).toBe("x");
    expect(first(undefined)).toBeUndefined();
  });

  it("never yields a page below 1", () => {
    expect(toPage("3")).toBe(3);
    expect(toPage(["7"])).toBe(7);
    expect(toPage("abc")).toBe(1);
    expect(toPage("-2")).toBe(1);
    expect(toPage(undefined)).toBe(1);
  });

  it("keeps only listing-related params as strings", () => {
    expect(listingParams({ sort: "price_asc", condition: ["NEW", "USED"], minPrice: "100", page: "2", foo: "bar" })).toEqual({
      sort: "price_asc",
      condition: "NEW",
      minPrice: "100",
      maxPrice: undefined,
      location: undefined,
      q: undefined,
    });
  });
});
