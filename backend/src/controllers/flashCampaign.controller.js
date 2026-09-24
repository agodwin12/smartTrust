const prisma = require("../config/prisma");
const service = require("../services/flashCampaign.service");
const audit = require("../services/audit.service");
const ApiError = require("../utils/ApiError");

async function myStoreId(userId) {
  const store = await prisma.store.findUnique({ where: { ownerId: userId }, select: { id: true } });
  if (!store) throw new ApiError(404, "You need a store to join a flash campaign.", "STORE_NOT_FOUND");
  return store.id;
}

/* public */
async function current(req, res) {
  res.set("Cache-Control", "public, max-age=10");
  res.json({ campaign: await service.current() });
}

async function upcoming(req, res) {
  res.set("Cache-Control", "public, max-age=10");
  res.json({ campaign: await service.upcoming() });
}

/* sellers */
async function listOpen(req, res) {
  const storeId = await myStoreId(req.user.id);
  res.json({ campaigns: await service.listOpen(storeId) });
}

async function listMine(req, res) {
  const storeId = await myStoreId(req.user.id);
  res.json({ items: await service.listMine(storeId) });
}

async function apply(req, res) {
  const storeId = await myStoreId(req.user.id);
  const item = await service.apply(req.params.id, storeId, req.body);
  audit.record(req, { action: "FLASH_APPLICATION_SUBMITTED", entityType: "FlashCampaignItem", entityId: item.id, metadata: { campaignId: req.params.id, advertisementId: item.advertisementId, campaignPrice: Number(item.campaignPrice) } });
  res.status(201).json({ item });
}

async function withdraw(req, res) {
  const storeId = await myStoreId(req.user.id);
  await service.withdraw(req.params.id, req.params.itemId, storeId);
  res.status(204).end();
}

/* admin */
async function listAll(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
  res.json(await service.listAll({ page, pageSize, status: req.query.status || undefined }));
}

async function getAdmin(req, res) {
  res.json({ campaign: await service.getAdmin(req.params.id) });
}

async function create(req, res) {
  const campaign = await service.create(req.body, req.user.id);
  audit.record(req, { action: "FLASH_CAMPAIGN_CREATED", entityType: "FlashCampaign", entityId: campaign.id, metadata: { name: campaign.name, startsAt: campaign.startsAt, endsAt: campaign.endsAt } });
  res.status(201).json({ campaign });
}

async function update(req, res) {
  const campaign = await service.update(req.params.id, req.body);
  audit.record(req, { action: "FLASH_CAMPAIGN_UPDATED", entityType: "FlashCampaign", entityId: campaign.id, metadata: req.body });
  res.json({ campaign });
}

async function publish(req, res) {
  const campaign = await service.publish(req.params.id);
  audit.record(req, { action: "FLASH_CAMPAIGN_PUBLISHED", entityType: "FlashCampaign", entityId: campaign.id });
  res.json({ campaign });
}

async function cancel(req, res) {
  const campaign = await service.cancel(req.params.id);
  audit.record(req, { action: "FLASH_CAMPAIGN_CANCELLED", entityType: "FlashCampaign", entityId: campaign.id });
  res.json({ campaign });
}

async function addItem(req, res) {
  const item = await service.addItem(req.params.id, req.body, req.user.id);
  audit.record(req, { action: "FLASH_ITEM_ADDED", entityType: "FlashCampaignItem", entityId: item.id, metadata: { campaignId: req.params.id, advertisementId: item.advertisementId, campaignPrice: Number(item.campaignPrice) } });
  res.status(201).json({ item });
}

async function reviewItem(req, res) {
  const item = await service.reviewItem(req.params.id, req.params.itemId, req.body, req.user.id);
  audit.record(req, { action: `FLASH_ITEM_${req.body.status}`, entityType: "FlashCampaignItem", entityId: item.id, metadata: { campaignId: req.params.id, campaignPrice: Number(item.campaignPrice), reviewNote: req.body.reviewNote ?? null } });
  res.json({ item });
}

async function removeItem(req, res) {
  await service.removeItem(req.params.id, req.params.itemId);
  audit.record(req, { action: "FLASH_ITEM_REMOVED", entityType: "FlashCampaignItem", entityId: req.params.itemId, metadata: { campaignId: req.params.id } });
  res.status(204).end();
}

module.exports = { current, upcoming, listOpen, listMine, apply, withdraw, listAll, getAdmin, create, update, publish, cancel, addItem, reviewItem, removeItem };
