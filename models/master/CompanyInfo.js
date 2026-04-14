import mongoose from "mongoose";

const companyInfoSchema = new mongoose.Schema(
  {
    companyLogo: {
      url: {
        type: String,
        trim: true,
      },
      publicId: {
        type: String,
        trim: true,
      },
    },
    brandLogos: {
      light: {
        url: {
          type: String,
          trim: true,
        },
        publicId: {
          type: String,
          trim: true,
        },
      },
      dark: {
        url: {
          type: String,
          trim: true,
        },
        publicId: {
          type: String,
          trim: true,
        },
      },
      collapsed: {
        url: {
          type: String,
          trim: true,
        },
        publicId: {
          type: String,
          trim: true,
        },
      },
    },
    generalInformation: {
      companyName: {
        type: String,
        trim: true,
      },
      contactEmail: {
        type: String,
        trim: true,
        lowercase: true,
      },
      phoneNumber: {
        type: String,
        trim: true,
      },
      socialLinks: {
        facebook: {
          type: String,
          trim: true,
        },
        instagram: {
          type: String,
          trim: true,
        },
        website: {
          type: String,
          trim: true,
        },
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
