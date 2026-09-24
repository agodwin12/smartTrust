const searchService = require("../services/search.service");

/** GET /api/search/suggest?q=… — public typeahead feed for the header search. */
async function suggest(req, res, next) {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const result = await searchService.suggest(q);
    // Browsers and the proxy may reuse a response for a few seconds; the service caches longer.
    res.set("Cache-Control", "public, max-age=15");
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = { suggest };
