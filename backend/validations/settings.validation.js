const { z } = require("zod");

const updateSettingsSchema = z.object({
  siteName: z.string().trim().min(1, "Site name is required"),
  logo: z.string().min(1, "Logo cannot be empty"),
  contactEmail: z.string().trim().optional().default(""),
  contactPhone: z.string().trim().optional().default(""),
  address: z.string().trim().optional().default(""),
  googleMapLink: z.string().trim().optional().default(""),
  facebookUrl: z.string().trim().optional().default(""),
  instagramUrl: z.string().trim().optional().default(""),
  tiktokUrl: z.string().trim().optional().default(""),
  youtubeUrl: z.string().trim().optional().default(""),
});

module.exports = {
  updateSettingsSchema,
};
