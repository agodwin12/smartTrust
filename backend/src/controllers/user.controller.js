const userService = require("../services/user.service");
const audit = require("../services/audit.service");

async function me(req, res) {
  res.json({ user: req.user });
}

async function updateMe(req, res) {
  const user = await userService.updateProfile(req.user.id, req.body);
  audit.record(req, { action: "PROFILE_UPDATED", entityType: "User", entityId: req.user.id, metadata: { fields: Object.keys(req.body) } });
  res.json({ user });
}

async function changePassword(req, res) {
  await userService.changePassword(req.user.id, req.body);
  audit.record(req, { action: "PASSWORD_CHANGED", entityType: "User", entityId: req.user.id });
  res.status(204).send();
}

async function list(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
  const { role, status, search } = req.query;

  const result = await userService.listUsers({ page, pageSize, role, status, search });
  res.json(result);
}

async function getById(req, res) {
  const user = await userService.getById(req.params.id);
  res.json({ user });
}

async function updateStatus(req, res) {
  const user = await userService.updateStatus(req.user, req.params.id, req.body.status);
  audit.record(req, { action: "USER_STATUS_CHANGED", entityType: "User", entityId: user.id, metadata: { status: req.body.status } });
  res.json({ user });
}

async function updateRole(req, res) {
  const user = await userService.updateRole(req.user, req.params.id, req.body.role);
  audit.record(req, { action: "USER_ROLE_CHANGED", entityType: "User", entityId: user.id, metadata: { role: req.body.role } });
  res.json({ user });
}

async function createStaff(req, res) {
  const user = await userService.createStaff(req.body);
  audit.record(req, { action: "STAFF_CREATED", entityType: "User", entityId: user.id, metadata: { role: user.role, email: user.email } });
  res.status(201).json({ user });
}

module.exports = { me, updateMe, changePassword, list, getById, updateStatus, updateRole, createStaff };
