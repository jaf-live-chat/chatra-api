import express from "express";
import { protect, masterAdminAuth } from "../../middlewares/authMiddleware.js";
import { uploadSingle } from "../../middlewares/fileUploadMiddleware.js";
import {
  getCompanyInfo,
  updateCompanyInfo,
  updateCompanyLogo,
} from "../../controllers/master/companyInfoControllers.js";
import { updateCompanyInfoValidator } from "../../validations/master/companyInfoValidator.js";

const router = express.Router();

router.get("/public", getCompanyInfo);
router.get("/", protect, masterAdminAuth, getCompanyInfo);
router.patch("/", protect, masterAdminAuth, updateCompanyInfoValidator, updateCompanyInfo);
router.patch("/logo", protect, masterAdminAuth, uploadSingle("logo", { fileCategory: "IMAGES" }), updateCompanyLogo);

export default router;
