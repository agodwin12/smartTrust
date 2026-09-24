import { describe, expect, it } from "vitest";
import { absoluteUrl, languageAlternates, localizedPath, seo, SITE_URL } from "./seo";

describe("seo helpers", () => {
  it("builds locale-aware paths: English at the root, French under /fr", () => {
    expect(localizedPath("en", "/")).toBe("/");
    expect(localizedPath("fr", "/")).toBe("/fr");
    expect(localizedPath("en", "/about/")).toBe("/about");
    expect(localizedPath("fr", "/products/x")).toBe("/fr/products/x");
    expect(absoluteUrl("fr", "/deals")).toBe(`${SITE_URL}/fr/deals`);
  });

  it("emits hreflang for every locale plus x-default", () => {
    expect(languageAlternates("/stores")).toEqual({
      en: `${SITE_URL}/stores`,
      fr: `${SITE_URL}/fr/stores`,
      "x-default": `${SITE_URL}/stores`,
    });
  });

  it("completes page metadata with canonical, Open Graph and Twitter", () => {
    const meta = seo("fr", "/products/phone", { title: "Phone", description: "A phone." }, { images: ["https://img/1.jpg"] });
    expect(meta.alternates?.canonical).toBe(`${SITE_URL}/fr/products/phone`);
    expect(meta.openGraph).toMatchObject({ url: `${SITE_URL}/fr/products/phone`, locale: "fr_FR", title: "Phone", description: "A phone.", images: ["https://img/1.jpg"] });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    expect(meta.robots).toBeUndefined();
  });

  it("marks private pages noindex and uses the summary card without images", () => {
    const meta = seo("en", "/cart", { title: "Cart" }, { noIndex: true });
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.twitter).toMatchObject({ card: "summary" });
    expect(meta.openGraph).toMatchObject({ locale: "en_US" });
  });
});
