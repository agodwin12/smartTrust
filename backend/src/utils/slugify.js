function slugify(text) {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Appends a short random suffix until `isTaken` reports the slug is free. */
async function uniqueSlug(base, isTaken) {
  const root = slugify(base) || "store";
  let candidate = root;
  let attempt = 0;

  while (await isTaken(candidate)) {
    attempt += 1;
    candidate = `${root}-${Math.random().toString(36).slice(2, 6)}`;
    if (attempt > 10) {
      throw new Error("Could not generate a unique slug.");
    }
  }

  return candidate;
}

module.exports = { slugify, uniqueSlug };
