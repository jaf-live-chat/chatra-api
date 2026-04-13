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
        default: "JAF Chatra",
      },
      contactEmail: {
        type: String,
        trim: true,
        lowercase: true,
        default: "jafchatra@gmail.com",
      },
      phoneNumber: {
        type: String,
        trim: true,
        default: "09554942621",
      },
      socialLinks: {
        facebook: {
          type: String,
          trim: true,
          default: "https://www.facebook.com/jafdigital/",
        },
        instagram: {
          type: String,
          trim: true,
          default: "https://www.instagram.com/jafdigitalofficial/",
        },
        website: {
          type: String,
          trim: true,
          default: "https://jafdigital.co/",
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
