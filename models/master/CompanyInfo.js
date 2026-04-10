import mongoose from "mongoose";

const companyInfoSchema = new mongoose.Schema(
  {
    companyLogo: {
      url: {
        type: String,
        trim: true,
        default: "",
      },
      publicId: {
        type: String,
        trim: true,
        default: "",
      },
    },
    brandLogos: {
      light: {
        url: {
          type: String,
          trim: true,
          default: "",
        },
        publicId: {
          type: String,
          trim: true,
          default: "",
        },
      },
      dark: {
        url: {
          type: String,
          trim: true,
          default: "",
        },
        publicId: {
          type: String,
          trim: true,
          default: "",
        },
      },
      collapsed: {
        url: {
          type: String,
          trim: true,
          default: "",
        },
        publicId: {
          type: String,
          trim: true,
          default: "",
        },
      },
    },
    generalInformation: {
      companyName: {
        type: String,
        trim: true,
        default: "",
      },
      website: {
        type: String,
        trim: true,
        default: "",
      },
      contactEmail: {
        type: String,
        trim: true,
        lowercase: true,
        default: "",
      },
      phoneNumber: {
        type: String,
        trim: true,
        default: "",
      },
    },
  },
  {
    timestamps: true,
  }
);

export const getCompanyInfoModel = (connection) => {
  if (connection.models.CompanyInfo) return connection.models.CompanyInfo;
  return connection.model("CompanyInfo", companyInfoSchema);
};
