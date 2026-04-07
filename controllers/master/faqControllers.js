import expressAsyncHandler from "express-async-handler";
import faqServices from "../../services/master/faqServices.js";
import { logger } from "../../utils/logger.js";

const getFAQsByQuery = expressAsyncHandler(async (_req, res) => {
  try {
    const faqs = await faqServices.getFAQsByQuery();

    res.status(200).json({
      success: true,
      count: faqs.length,
      faqs,
    });
  } catch (error) {
    logger.error(`Error fetching FAQs: ${error.message}`);
    throw error;
  }
});

const createFAQ = expressAsyncHandler(async (req, res) => {
  try {
    const faq = await faqServices.createFAQ(req.body);

    res.status(201).json({
      success: true,
      message: "FAQ created successfully.",
      faq,
    });
  } catch (error) {
    logger.error(`Error creating FAQ: ${error.message}`);
    throw error;
  }
});

const getFAQById = expressAsyncHandler(async (req, res) => {
  try {
    const faq = await faqServices.getFAQById(req.params.id);

    res.status(200).json({
      success: true,
      faq,
    });
  } catch (error) {
    logger.error(`Error fetching FAQ by id: ${error.message}`);
    throw error;
  }
});

const updateFAQById = expressAsyncHandler(async (req, res) => {
  try {
    const faq = await faqServices.updateFAQById(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: "FAQ updated successfully.",
      faq,
    });
  } catch (error) {
    logger.error(`Error updating FAQ: ${error.message}`);
    throw error;
  }
});

const deleteFAQById = expressAsyncHandler(async (req, res) => {
  try {
    await faqServices.deleteFAQById(req.params.id);

    res.status(200).json({
      success: true,
      message: "FAQ deleted successfully.",
    });
  } catch (error) {
    logger.error(`Error deleting FAQ: ${error.message}`);
    throw error;
  }
});

const reorderFAQs = expressAsyncHandler(async (req, res) => {
  try {
    const faqs = await faqServices.reorderFAQs(req.body?.ids);

    res.status(200).json({
      success: true,
      message: "FAQs reordered successfully.",
      count: faqs.length,
      faqs,
    });
  } catch (error) {
    logger.error(`Error reordering FAQs: ${error.message}`);
    throw error;
  }
});

export {
  getFAQsByQuery,
  createFAQ,
  getFAQById,
  updateFAQById,
  deleteFAQById,
  reorderFAQs,
};
