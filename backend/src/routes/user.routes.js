const { Router } = require("express");
const controller = require("../controllers/user.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const { validateBody } = require("../middlewares/validate");
const { ROLES, STAFF, OPERATIONS } = require("../utils/roles");
const {
  updateProfileSchema,
  changePasswordSchema,
  updateUserStatusSchema,
  updateUserRoleSchema,
  createStaffSchema,
} = require("../validators/user.validators");

const router = Router();

router.use(authenticate);

router.get("/me", controller.me);
router.patch("/me", validateBody(updateProfileSchema), controller.updateMe);
router.patch("/me/password", validateBody(changePasswordSchema), controller.changePassword);

// Any staff can look users up; only operations roles can act on them; only the
// Super Admin can create staff or change anyone's role.
router.get("/", authorize(...STAFF), controller.list);
router.post("/staff", authorize(ROLES.SUPER_ADMIN), validateBody(createStaffSchema), controller.createStaff);
router.get("/:id", authorize(...STAFF), controller.getById);
router.patch("/:id/status", authorize(...OPERATIONS), validateBody(updateUserStatusSchema), controller.updateStatus);
router.patch("/:id/role", authorize(ROLES.SUPER_ADMIN), validateBody(updateUserRoleSchema), controller.updateRole);

module.exports = router;
