import { getMasterConnection } from "../../config/masterDB.js";
import { AppError, BadRequestError, InternalServerError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

const normalizeString = (value) => String(value || "").trim();

const buildEmptyLogo = () => ({
  url: "",
  publicId: "",
});

const pickLogo = (source = {}, legacySource = {}) => ({
  url: source?.url || legacySource?.url || "",
  publicId: source?.publicId || legacySource?.publicId || "",
});

const sanitizeCompanyInfo = (companyInfo) => {
  if (!companyInfo) {
    return {
      companyLogo: {
        ...buildEmptyLogo(),
      },
      brandLogos: {
        light: buildEmptyLogo(),
        dark: buildEmptyLogo(),
        collapsed: buildEmptyLogo(),
      },
      generalInformation: {
        companyName: "",
        website: "",
        contactEmail: "",
        phoneNumber: "",
      },
    };
  }

  const infoObject =
    typeof companyInfo.toObject === "function"
      ? companyInfo.toObject()
      : { ...companyInfo };

  return {
    _id: infoObject._id,
    companyLogo: {
      url: infoObject.companyLogo?.url || "",
      publicId: infoObject.companyLogo?.publicId || "",
    },
    brandLogos: {
      light: pickLogo(infoObject.brandLogos?.light, infoObject.companyLogo),
      dark: pickLogo(infoObject.brandLogos?.dark, infoObject.companyLogo),
      collapsed: pickLogo(infoObject.brandLogos?.collapsed, infoObject.companyLogo),
    },
    generalInformation: {
      companyName: infoObject.generalInformation?.companyName || "",
      website: infoObject.generalInformation?.website || "",
      contactEmail: infoObject.generalInformation?.contactEmail || "",
      phoneNumber: infoObject.generalInformation?.phoneNumber || "",
    },
    createdAt: infoObject.createdAt,
    updatedAt: infoObject.updatedAt,
  };
};

const buildCompanyInfoUpdatePayload = (payload = {}) => {
  const updateData = {};

  if (payload.generalInformation && typeof payload.generalInformation === "object") {
    if (Object.prototype.hasOwnProperty.call(payload.generalInformation, "companyName")) {
      updateData["generalInformation.companyName"] = normalizeString(payload.generalInformation.companyName);
    }
    if (Object.prototype.hasOwnProperty.call(payload.generalInformation, "website")) {
      updateData["generalInformation.website"] = normalizeString(payload.generalInformation.website);
    }
    if (Object.prototype.hasOwnProperty.call(payload.generalInformation, "contactEmail")) {
      updateData["generalInformation.contactEmail"] = normalizeString(payload.generalInformation.contactEmail).toLowerCase();
    }
    if (Object.prototype.hasOwnProperty.call(payload.generalInformation, "phoneNumber")) {
      updateData["generalInformation.phoneNumber"] = normalizeString(payload.generalInformation.phoneNumber);
    }
  }

  return updateData;
};

const buildLogoUpdatePayload = (logoType, companyLogo) => {
  const logoUrl = normalizeString(companyLogo?.url);

  if (!logoUrl) {
    throw new BadRequestError("companyLogo.url is required.");
  }

  const normalizedLogoType = String(logoType || "").trim().toLowerCase();

  if (!normalizedLogoType || !["light", "dark", "collapsed", "main"].includes(normalizedLogoType)) {
    throw new BadRequestError("logoType must be one of light, dark, collapsed, or main.");
  }

  const updateData = {
    [`brandLogos.${normalizedLogoType === "main" ? "collapsed" : normalizedLogoType}.url`]: logoUrl,
    [`brandLogos.${normalizedLogoType === "main" ? "collapsed" : normalizedLogoType}.publicId`]: normalizeString(companyLogo?.publicId),
  };

  if (normalizedLogoType === "main") {
    updateData["companyLogo.url"] = logoUrl;
    updateData["companyLogo.publicId"] = normalizeString(companyLogo?.publicId);
  }

  return updateData;
};

const getCompanyInfo = async () => {
  try {
    const { CompanyInfo } = getMasterConnection();
    const companyInfo = await CompanyInfo.findOne().lean();

    return {
      companyInfo: sanitizeCompanyInfo(companyInfo),
    };
  } catch (error) {
    logger.error(`Error retrieving company info: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to retrieve company info: ${error.message}`);
  }
};

const updateCompanyInfo = async (payload = {}) => {
  try {
    const { companyInfoData } = payload;
    const updateData = buildCompanyInfoUpdatePayload(companyInfoData);

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError("At least one company info field is required.");
    }

    const { CompanyInfo } = getMasterConnection();
    const updatedCompanyInfo = await CompanyInfo.findOneAndUpdate(
      {},
      { $set: updateData },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    ).lean();

    return {
      companyInfo: sanitizeCompanyInfo(updatedCompanyInfo),
    };
  } catch (error) {
    logger.error(`Error updating company info: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to update company info: ${error.message}`);
  }
};

const updateCompanyLogo = async (payload = {}) => {
  try {
    const { companyLogo, logoType } = payload;
    const updateData = buildLogoUpdatePayload(logoType, companyLogo);

    const { CompanyInfo } = getMasterConnection();
    const updatedCompanyInfo = await CompanyInfo.findOneAndUpdate(
      {},
      {
        $set: updateData,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    ).lean();

    return {
      companyInfo: sanitizeCompanyInfo(updatedCompanyInfo),
    };
  } catch (error) {
    logger.error(`Error updating company logo: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to update company logo: ${error.message}`);
  }
};

export default {
  getCompanyInfo,
  updateCompanyInfo,
  updateCompanyLogo,
};
