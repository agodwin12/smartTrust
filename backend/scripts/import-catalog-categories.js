#!/usr/bin/env node
/*
 * Creates the catalog categories listed in scripts/catalog/categories.json through the
 * public API (so slugs, R2 uploads and cache invalidation behave exactly as in the admin).
 *
 * Idempotent: a category whose name already exists under the same parent is left alone.
 *
 *   API_URL=http://localhost:5000/api ADMIN_EMAIL=… ADMIN_PASSWORD=… \
 *   IMAGES_DIR=../images/drive-download-20260923T215307Z-1-001 node scripts/import-catalog-categories.js
 */
const fs = require("node:fs");
const path = require("node:path");
const { slugify } = require("../src/utils/slugify");

const API_URL = (process.env.API_URL || "http://localhost:5000/api").replace(/\/$/, "");
const IMAGES_DIR = path.resolve(__dirname, "..", process.env.IMAGES_DIR || "../images/drive-download-20260923T215307Z-1-001");
const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "catalog", "categories.json"), "utf8"));

async function api(pathname, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API_URL}${pathname}`, {
    method,
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}) },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${pathname} → ${res.status} ${data?.code ?? ""} ${data?.error ?? ""}`.trim());
  return data;
}

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required (a SUPER_ADMIN or CUSTOMER_SERVICE account).");

  const { accessToken } = await api("/auth/login", { method: "POST", body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  const existing = (await api("/categories?pageSize=500")).items;
  const bySlug = new Map(existing.map((c) => [c.slug, c]));
  const summary = { created: [], skipped: [], failed: [] };

  for (const entry of manifest.categories) {
    const parent = entry.parent ? bySlug.get(entry.parent) : null;
    if (entry.parent && !parent) {
      summary.failed.push(`${entry.name}: parent "${entry.parent}" not found`);
      continue;
    }
    const duplicate = existing.find((c) => c.name.trim().toLowerCase() === entry.name.toLowerCase() && (c.parentId ?? null) === (parent?.id ?? null));
    if (duplicate) {
      summary.skipped.push(`${entry.name} (${duplicate.slug})`);
      bySlug.set(slugify(entry.name), duplicate);
      continue;
    }

    const imagePath = path.join(IMAGES_DIR, entry.image);
    if (!fs.existsSync(imagePath)) {
      summary.failed.push(`${entry.name}: image missing ${imagePath}`);
      continue;
    }

    const form = new FormData();
    form.set("name", entry.name);
    if (parent) form.set("parentId", parent.id);
    form.set("image", new Blob([fs.readFileSync(imagePath)], { type: "image/jpeg" }), path.basename(imagePath).replace(/\.jpe?g$/i, ".jpg"));

    try {
      const { category } = await api("/categories", { method: "POST", token: accessToken, body: form });
      existing.push(category);
      bySlug.set(category.slug, category);
      summary.created.push(`${category.name} → /categories/${category.slug}${parent ? ` (under ${parent.slug})` : " (root)"}${category.imageUrl ? " +image" : " (no image)"}`);
    } catch (error) {
      summary.failed.push(`${entry.name}: ${error.message}`);
    }
  }

  for (const [label, items] of Object.entries(summary)) {
    console.log(`${label.toUpperCase()} (${items.length})`);
    for (const line of items) console.log("  -", line);
  }
  if (summary.failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
