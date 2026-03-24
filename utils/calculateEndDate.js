const normalizePositiveInterval = (value) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("interval must be an integer greater than or equal to 1");
  }

  return parsed;
};

const toValidDate = (value) => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("startDate must be a valid date");
  }

  return date;
};

const calculateEndDate = (startDate, billingCycle, interval = 1) => {
  const endDate = toValidDate(startDate);
  const normalizedCycle = String(billingCycle || "").trim().toLowerCase();
  const normalizedInterval = normalizePositiveInterval(interval);

  switch (normalizedCycle) {
    case "daily":
      endDate.setDate(endDate.getDate() + normalizedInterval);
      break;
    case "weekly":
      endDate.setDate(endDate.getDate() + (normalizedInterval * 7));
      break;
    case "monthly":
      endDate.setMonth(endDate.getMonth() + normalizedInterval);
      break;
    case "yearly":
      endDate.setFullYear(endDate.getFullYear() + normalizedInterval);
      break;
    default:
      throw new Error(`Unsupported billingCycle: ${billingCycle}`);
  }

  return endDate;
};

export default calculateEndDate;
