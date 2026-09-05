import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CatalogFeedback } from "../src/components/CatalogFeedback";
import { ProductImage } from "../src/components/ProductImage";

const base = { loading: false, error: null, total: 0, matches: 0, retry() {}, clearFilters() {} };
const feedback = (props: Partial<Omit<typeof base, "error">> & { error?: string | null }) => renderToStaticMarkup(createElement(CatalogFeedback, { ...base, ...props }));

test("a failed collection request provides retry, never a zero-results explanation", () => {
  const html = feedback({ error: "Network unavailable" });
  assert.match(html, /The collection couldn’t load/);
  assert.match(html, /Try again/);
  assert.doesNotMatch(html, /No pieces match|Clear filters|new edit is on/);
});

test("retrying an empty collection shows loading without stale error or empty-result messages", () => {
  const html = feedback({ loading: true, error: "Network unavailable" });
  assert.match(html, /collection is loading/);
  assert.doesNotMatch(html, /couldn’t load|No pieces match|Try again/);
  assert.equal(feedback({ loading: true, total: 8, matches: 8 }), "");
});

test("an empty catalog and a filtered-out collection have different recovery guidance", () => {
  const empty = feedback({});
  assert.match(empty, /new edit is on its way/);
  assert.doesNotMatch(empty, /Clear filters/);
  const filtered = feedback({ total: 8 });
  assert.match(filtered, /No pieces match your selection/);
  assert.match(filtered, /Clear filters/);
  assert.equal(feedback({ total: 8, matches: 3 }), "");
});

test("missing product photography is disclosed without a broken or unrelated image", () => {
  const missing = renderToStaticMarkup(createElement(ProductImage, { images: [], alt: "Silk scarf" }));
  assert.match(missing, /Silk scarf: photograph unavailable/);
  assert.doesNotMatch(missing, /<img|unsplash/);
  const present = renderToStaticMarkup(createElement(ProductImage, { images: ["", "/actual-scarf.jpg"], alt: "Silk scarf" }));
  assert.match(present, /src="\/actual-scarf.jpg"/);
});
