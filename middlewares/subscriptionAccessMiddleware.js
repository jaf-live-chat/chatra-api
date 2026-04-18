const allowInactiveSubscriptionReadOnly = (req, _res, next) => {
  req.allowInactiveSubscriptionReadOnly = true;
  next();
};

export { allowInactiveSubscriptionReadOnly };