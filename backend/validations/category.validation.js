const { z } = require("zod");

const createCategorySchema = z.object({
    name: z.string().min(2, "Category name is required"),

    slug: z.string().min(2, "Slug is required"),

    image: z.string().optional().default(""),

    children: z.array(
        z.object({
            name: z.string().min(2, "Child name is required"),

            slug: z.string().min(2, "Child slug is required"),

            categories: z.array(z.string()).optional().default([])
        })
    ).optional().default([])
});

const updateCategorySchema = z.object({
    name: z.string().min(2).optional(),

    slug: z.string().min(2).optional(),

    image: z.string().optional(),

    children: z.array(
        z.object({
            name: z.string().min(2),

            slug: z.string().min(2),

            categories: z.array(z.string()).optional().default([])
        })
    ).optional()
});

module.exports = {
    createCategorySchema,
    updateCategorySchema
};