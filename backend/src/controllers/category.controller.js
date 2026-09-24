const categoryService = require("../services/category.service");
const audit = require("../services/audit.service");

async function create(req, res) {
  const category = await categoryService.createCategory(req.body, req.file);
  audit.record(req, { action: "CATEGORY_CREATED", entityType: "Category", entityId: category.id, metadata: { name: category.name } });
  res.status(201).json({ category });
}

async function update(req, res) {
  const category = await categoryService.updateCategory(req.params.id, req.body, req.file);
  audit.record(req, { action: "CATEGORY_UPDATED", entityType: "Category", entityId: category.id, metadata: req.body });
  res.json({ category });
}

async function list(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 50, 1), 100);
  const result = await categoryService.listCategories({
    parentId: req.query.parentId,
    page,
    pageSize,
    withCounts: req.query.withCounts === "true" || req.query.withCounts === "1",
  });
  res.json(result);
}

async function getBySlug(req, res) {
  const category = await categoryService.getBySlug(req.params.slug);
  res.json({ category });
}

async function remove(req, res) {
  await categoryService.deleteCategory(req.params.id);
  audit.record(req, { action: "CATEGORY_DELETED", entityType: "Category", entityId: req.params.id });
  res.status(204).send();
}

module.exports = { create, update, list, getBySlug, remove };
