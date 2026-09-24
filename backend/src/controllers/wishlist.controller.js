const wishlistService = require("../services/wishlist.service");

async function list(req, res) {
  res.json({ items: await wishlistService.list(req.user.id) });
}

async function add(req, res) {
  const item = await wishlistService.add(req.user.id, req.params.advertisementId);
  res.status(201).json({ item });
}

async function remove(req, res) {
  await wishlistService.remove(req.user.id, req.params.advertisementId);
  res.status(204).send();
}

async function merge(req, res) {
  res.json({ items: await wishlistService.merge(req.user.id, req.body.advertisementIds) });
}

module.exports = { list, add, remove, merge };
