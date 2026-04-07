import mongoose from "mongoose";

const FAQsSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
    },
    answer: {
      type: String,
      required: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

export const getFAQsModel = (connection) => {
  if (connection.models.FAQs) return connection.models.FAQs;
  return connection.model("FAQs", FAQsSchema);
};
