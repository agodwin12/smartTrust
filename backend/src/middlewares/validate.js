const ApiError = require("../utils/ApiError");

/** Validates req.body against a zod schema and replaces it with the parsed (typed, trimmed) result. */
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join(" ");
      return next(new ApiError(422, message, "VALIDATION_ERROR"));
    }

    req.body = result.data;
    next();
  };
}

module.exports = { validateBody };
