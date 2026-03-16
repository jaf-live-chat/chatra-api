const databaseNameSlugger = (companyName = "") => {
  const slug = companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `tenant_${slug}`;
};

export default databaseNameSlugger;