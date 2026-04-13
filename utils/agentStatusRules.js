import { USER_STATUS } from "../constants/constants.js";

const normalizeStatus = (value) => String(value || "").trim().toUpperCase();

export const getManagedAgentStatus = (openConversationCount) => {
  return openConversationCount > 0 ? USER_STATUS.BUSY : USER_STATUS.AVAILABLE;
};

export const canManuallyUpdateAgentStatus = (requestedStatus, openConversationCount) => {
  const normalizedStatus = normalizeStatus(requestedStatus);

  if (!normalizedStatus) {
    return {
      allowed: false,
      message: "status is required",
    };
  }

  if (normalizedStatus === USER_STATUS.BUSY) {
    return {
      allowed: false,
      message: "Busy status is managed automatically when you have active chats.",
    };
  }

  if (openConversationCount > 0) {
    return {
      allowed: false,
      message: "You can't change your status when you have an active chat.",
    };
  }

  if (![USER_STATUS.AVAILABLE, USER_STATUS.AWAY].includes(normalizedStatus)) {
    return {
      allowed: false,
      message: "Invalid status value.",
    };
  }

  return {
    allowed: true,
    status: normalizedStatus,
  };
};
