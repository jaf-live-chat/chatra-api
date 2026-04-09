import { USER_ROLES } from "../constants/constants.js";
import { ForbiddenError } from "../utils/errors.js";

const staffRoles = [
  USER_ROLES.MASTER_ADMIN.value,
  USER_ROLES.ADMIN.value,
  USER_ROLES.SUPPORT_AGENT.value,
];

const liveChatStaffAuth = (req, res, next) => {
  if (!req.agent || !staffRoles.includes(req.agent.role)) {
    return next(new ForbiddenError("Access denied. Agent or admin role required."));
  }

  return next();
};

export { liveChatStaffAuth };