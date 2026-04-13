import { USER_ROLES } from "../constants/constants.js";

const normalizeText = (value) => String(value ?? "").trim().toUpperCase();

export const isAdminOrMasterRole = (role) => {
  const normalizedRole = normalizeText(role);
  return [USER_ROLES.ADMIN.value, USER_ROLES.MASTER_ADMIN.value].includes(normalizedRole);
};
