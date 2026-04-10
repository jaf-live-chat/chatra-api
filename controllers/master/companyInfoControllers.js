import expressAsyncHandler from "express-async-handler";
import companyInfoServices from "../../services/master/companyInfoServices.js";
import { BadRequestError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { uploadToCloudinary } from "../../utils/fileUploadService.js";

const getCompanyInfo = expressAsyncHandler(async (_req, res) => {
  try {
    const response = await companyInfoServices.getCompanyInfo();

    res.status(200).json({
      success: true,
      message: "Company info retrieved successfully.",
      companyInfo: response.companyInfo,
    });
  } catch (error) {
    logger.error(`Error retrieving company info: ${error.message}`);
    throw error;
  }
});

const updateCompanyInfo = expressAsyncHandler(async (req, res) => {
  try {
    const response = await companyInfoServices.updateCompanyInfo({
      companyInfoData: req.body,
    });

    res.status(200).json({
      success: true,
      message: "Company info updated successfully.",
      companyInfo: response.companyInfo,
    });
  } catch (error) {
    logger.error(`Error updating company info: ${error.message}`);
    throw error;
  }
});

const updateCompanyLogo = expressAsyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      throw new BadRequestError("Company logo file is required.");
    }

    const uploadedLogo = await uploadToCloudinary(req.file, {
      folder: "jaf-chatra/company-info",
      fileCategory: "IMAGES",
      resource_type: "image",
    });

    const response = await companyInfoServices.updateCompanyLogo({
      logoType: req.body.logoType,
      companyLogo: {
        url: uploadedLogo.url,
        publicId: uploadedLogo.publicId,
      },
    });

    res.status(200).json({
      success: true,
      message: "Company logo updated successfully.",
      companyInfo: response.companyInfo,
    });
  } catch (error) {
    logger.error(`Error updating company logo: ${error.message}`);
    throw error;
  }
});

export {
  getCompanyInfo,
  updateCompanyInfo,
  updateCompanyLogo,
};
