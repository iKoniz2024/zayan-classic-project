const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");
const { withCache, clearCache } = require("../utils/cache");
const { buildIdQuery } = require("../utils/buildIdQuery");

const createProduct = async (req, res) => {
    try {
        const db = getDB();
        const productsCollection = db.collection("products");

        const {
            title,
            description,
            category,
            price,
            discountPercentage,
            stock,
            tags,
            brand,
            weight,
            dimensions,
            warrantyInformation,
            shippingInformation,
            returnPolicy,
            minimumOrderQuantity,
            sizes,
            sizeMeasurements,
            colors,
            images,
            thumbnail
        } = req.body;

        const normalizedPrice = Number(price ?? 0);
        const normalizedDiscountPercentage = Number(discountPercentage ?? 0);
        const normalizedStock = Number(stock ?? 0);
        const normalizedMinimumOrderQuantity = Number(minimumOrderQuantity ?? 1);

        const newProduct = {
            title,
            description,
            category,
            price: normalizedPrice,
            discountPercentage: normalizedDiscountPercentage,
            rating: 0,
            stock: normalizedStock,
            tags,
            brand,
            sku: `SKU-${Date.now()}`,
            weight: Number(weight ?? 0),

            dimensions: {
                width: dimensions?.width || null,
                height: dimensions?.height || null,
                depth: dimensions?.depth || null
            },

            warrantyInformation,
            shippingInformation,

            availabilityStatus: normalizedStock > 0
                ? "In Stock"
                : "Out of Stock",

            reviews: [],

            returnPolicy,
            minimumOrderQuantity: normalizedMinimumOrderQuantity,
            sizes: sizes || [],
            sizeMeasurements: sizeMeasurements || [],
            colors: colors || [],

            meta: {
                createdAt: new Date(),
                updatedAt: new Date(),
                barcode: "",
                qrCode: ""
            },

            images,
            thumbnail
        };

        const result = await productsCollection.insertOne(newProduct);
        clearCache();

        res.status(201).send({
            message: "Product created successfully",
            insertedId: result.insertedId
        });

    } catch (error) {
        console.log(error);
        res.status(500).send({
            message: "Internal Server Error"
        });
    }
};

const getBestSellingProductsInternal = async (db) => {
    const productsCollection = db.collection("products");
    const ordersCollection = db.collection("orders");

    let products = await ordersCollection
        .aggregate([
            { $unwind: "$items" },
            {
                $project: {
                    productId: {
                        $cond: {
                            if: { $eq: [{ $type: "$items.productId" }, "string"] },
                            then: {
                                $convert: {
                                    input: "$items.productId",
                                    to: "objectId",
                                    onError: "$items.productId",
                                    onNull: "$items.productId"
                                }
                            },
                            else: "$items.productId"
                        }
                    },
                    quantity: "$items.quantity"
                }
            },
            {
                $group: {
                    _id: "$productId",
                    totalSold: { $sum: "$quantity" }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 12 },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "product"
                }
            },
            { $unwind: "$product" },
            {
                $replaceRoot: {
                    newRoot: {
                        $mergeObjects: ["$product", { totalSold: "$totalSold" }]
                    }
                }
            },
            {
                $project: {
                    description: 0,
                    dimensions: 0,
                    reviews: 0,
                    images: 0,
                    sizeMeasurements: 0,
                    warrantyInformation: 0,
                    shippingInformation: 0,
                    returnPolicy: 0,
                    meta: 0,
                    tags: 0,
                    sku: 0,
                    weight: 0,
                    availabilityStatus: 0,
                    minimumOrderQuantity: 0
                }
            }
        ])
        .toArray();

    if (products.length < 8) {
        const existingIds = products.map(p => p._id);
        const needed = 12 - products.length;
        const extraProducts = await productsCollection
            .find({ _id: { $nin: existingIds } })
            .project({
                description: 0,
                dimensions: 0,
                reviews: 0,
                images: 0,
                sizeMeasurements: 0,
                warrantyInformation: 0,
                shippingInformation: 0,
                returnPolicy: 0,
                meta: 0,
                tags: 0,
                sku: 0,
                weight: 0,
                availabilityStatus: 0,
                minimumOrderQuantity: 0
            })
            .sort({ rating: -1, _id: -1 })
            .limit(needed)
            .toArray();

        products = [...products, ...extraProducts];
    }

    return products.map(product => ({
        ...product,
        colors: (product.colors || []).map(c => ({
            name: c.name,
            hex: c.hex,
            image: c.image && c.image !== product.thumbnail ? c.image : undefined
        })),
        badge: "best-seller"
    }));
};

const getBestSellingIds = async (db) => {
    return await withCache("bestSellingIdsSet", 600, async () => {
        try {
            const bestProducts = await getBestSellingProductsInternal(db);
            return Array.from(new Set(bestProducts.map(p => (p._id ? p._id.toString() : ""))));
        } catch {
            return [];
        }
    });
};

const getProductsCatalog = async (db) => {
    return await withCache("productsCatalog", 300, async () => {
        const productsCollection = db.collection("products");
        const prods = await productsCollection
            .find({})
            .project({
                title: 1,
                price: 1,
                discountPercentage: 1,
                stock: 1,
                thumbnail: 1,
                colors: 1,
                category: 1,
                brand: 1,
                rating: 1,
                badge: 1,
                createdAt: 1,
                "meta.createdAt": 1
            })
            .sort({ _id: -1 })
            .toArray();

        const bestSellingIds = await getBestSellingIds(db);
        const bestSellingIdsSet = new Set(bestSellingIds);

        return prods.map(p => ({
            ...p,
            colors: (p.colors || []).map(c => ({
                name: c.name,
                hex: c.hex,
                image: c.image && c.image !== p.thumbnail ? c.image : undefined
            })),
            badge: p.badge || (bestSellingIdsSet.has(p._id ? p._id.toString() : "") ? "best-seller" : null)
        }));
    });
};

const getAllProducts = async (req, res) => {
    try {
        const db = getDB();
        const limit = req.query.limit ? parseInt(req.query.limit) : null;
        const page = req.query.page ? parseInt(req.query.page) : (limit ? 1 : null);

        const search = (req.query.search || "").trim();
        const category = (req.query.category || "").trim();
        const brand = (req.query.brand || "").trim();
        const sort = (req.query.sort || "").trim();

        // High-speed In-Memory Catalog Filter & Search (sub-millisecond)
        let catalog = await getProductsCatalog(db);

        // Filter by category
        if (category) {
            const catArray = category.split(",").map(c => c.trim().toLowerCase()).filter(Boolean);
            if (catArray.length > 0) {
                catalog = catalog.filter(p => {
                    if (!p.category) return false;
                    const pCat = String(p.category).toLowerCase();
                    return catArray.includes(pCat);
                });
            }
        }

        // Filter by brand
        if (brand) {
            const cleanBrand = brand.toLowerCase();
            catalog = catalog.filter(p => (p.brand || "").toLowerCase() === cleanBrand);
        }

        // Search by title, brand, category
        if (search) {
            const searchTerms = search.toLowerCase().split(/\s+/).filter(Boolean);
            if (searchTerms.length > 0) {
                catalog = catalog.filter(p => {
                    const pTitle = (p.title || "").toLowerCase();
                    const pBrand = (p.brand || "").toLowerCase();
                    const pCat = (p.category || "").toLowerCase();
                    return searchTerms.every(term =>
                        pTitle.includes(term) || pBrand.includes(term) || pCat.includes(term)
                    );
                });
            }
        }

        // Sorting
        if (sort === "asc") {
            catalog = [...catalog].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
        } else if (sort === "desc") {
            catalog = [...catalog].sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
        } else {
            // Newest default (sorted by _id)
            catalog = [...catalog].sort((a, b) => String(b._id).localeCompare(String(a._id)));
        }

        const totalProducts = catalog.length;

        if (limit) {
            const pageNum = page || 1;
            const totalPages = Math.ceil(totalProducts / limit) || 1;
            const skip = (pageNum - 1) * limit;
            const paginatedProducts = catalog.slice(skip, skip + limit);

            return res.send({
                totalProducts,
                currentPage: pageNum,
                totalPages,
                products: paginatedProducts,
            });
        }

        return res.send({
            totalProducts,
            products: catalog,
        });

    } catch (error) {
        console.error("getAllProducts error:", error);
        res.status(500).send({ message: "Internal Server Error" });
    }
};

const getSingleProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDB();
        const productsCollection = db.collection("products");

        const result = await withCache(`product_${id}`, 300, () => productsCollection.findOne(buildIdQuery(id)));

        if (!result) {
            return res.status(404).send({ message: "Product not found" });
        }

        res.send(result);
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal Server Error" });
    }
};

const getRelatedProducts = async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDB();

        const cacheKey = `related_${id}`;
        const related = await withCache(cacheKey, 300, async () => {
            const catalog = await getProductsCatalog(db);
            const currentStrId = String(id).toLowerCase();
            const currentProduct = catalog.find(p => String(p._id).toLowerCase() === currentStrId);
            const category = currentProduct?.category ? String(currentProduct.category).toLowerCase() : "";

            let sameCategory = [];
            let otherProducts = [];

            for (const p of catalog) {
                if (String(p._id).toLowerCase() === currentStrId) continue;
                const pCat = p.category ? String(p.category).toLowerCase() : "";
                if (category && pCat === category) {
                    sameCategory.push(p);
                } else {
                    otherProducts.push(p);
                }
            }

            return [...sameCategory, ...otherProducts].slice(0, 12);
        });

        res.send(related);
    } catch (error) {
        console.error("getRelatedProducts error:", error);
        res.status(500).send({ message: "Internal Server Error" });
    }
};

const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDB();
        const productsCollection = db.collection("products");

        const updatedFields = {
            ...req.body,
            ...(req.body.price !== undefined && { price: Number(req.body.price) }),
            ...(req.body.discountPercentage !== undefined && { discountPercentage: Number(req.body.discountPercentage) }),
            ...(req.body.stock !== undefined && { stock: Number(req.body.stock) }),
            ...(req.body.weight !== undefined && { weight: Number(req.body.weight) }),
            ...(req.body.minimumOrderQuantity !== undefined && { minimumOrderQuantity: Number(req.body.minimumOrderQuantity) }),
            "meta.updatedAt": new Date()
        };

        const result = await productsCollection.updateOne(
            buildIdQuery(id),
            { $set: updatedFields }
        );

        if (result.matchedCount === 0) {
            return res.status(404).send({ message: "Product not found" });
        }

        clearCache();
        res.send({ message: "Product updated successfully" });

    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDB();
        const productsCollection = db.collection("products");

        const result = await productsCollection.deleteOne(buildIdQuery(id));

        if (result.deletedCount === 0) {
            return res.status(404).send({ message: "Product not found" });
        }

        clearCache();
        res.send({ message: "Product deleted successfully" });

    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" });
    }
};

const getFlashSaleProducts = async (req, res) => {
    try {
        const { products, maxStock } = await withCache("flashSaleProducts", 300, async () => {
            const db = getDB();
            const productsCollection = db.collection("products");

            let products = await productsCollection
                .aggregate([
                    {
                        $match: {
                            discountPercentage: { $gt: 0 },
                            stock: { $gt: 0 }
                        }
                    },
                    {
                        $project: {
                            description: 0,
                            dimensions: 0,
                            reviews: 0,
                            images: 0,
                            sizeMeasurements: 0,
                            warrantyInformation: 0,
                            shippingInformation: 0,
                            returnPolicy: 0,
                            meta: 0,
                            tags: 0,
                            sku: 0,
                            weight: 0,
                            availabilityStatus: 0,
                            minimumOrderQuantity: 0
                        }
                    },
                    {
                        $sort: {
                            discountPercentage: -1
                        }
                    },
                    {
                        $limit: 12
                    }
                ])
                .toArray();

            if (products.length < 8) {
                const existingIds = products.map(p => p._id);
                const needed = 12 - products.length;
                const extra = await productsCollection
                    .find({ _id: { $nin: existingIds }, stock: { $gt: 0 } })
                    .project({
                        description: 0,
                        dimensions: 0,
                        reviews: 0,
                        images: 0,
                        sizeMeasurements: 0,
                        warrantyInformation: 0,
                        shippingInformation: 0,
                        returnPolicy: 0,
                        meta: 0,
                        tags: 0,
                        sku: 0,
                        weight: 0,
                        availabilityStatus: 0,
                        minimumOrderQuantity: 0
                    })
                    .sort({ _id: -1 })
                    .limit(needed)
                    .toArray();

                products = [...products, ...extra];
            }

            const maxStock = products.length > 0
                ? Math.max(...products.map(p => p.stock || 1))
                : 1;

            const cleanProducts = products.map(p => ({
                ...p,
                colors: (p.colors || []).map(c => ({
                    name: c.name,
                    hex: c.hex,
                    image: c.image && c.image !== p.thumbnail ? c.image : undefined
                }))
            }));

            return { products: cleanProducts, maxStock };
        });

        res.send({ products, maxStock });
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" });
    }
};

const getBestSellingProducts = async (req, res) => {
    try {
        const result = await withCache("bestSellingProducts", 300, async () => {
            const db = getDB();
            return await getBestSellingProductsInternal(db);
        });

        res.send({ products: result });
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" });
    }
};

const getNewArrivals = async (req, res) => {
    try {
        const products = await withCache("newArrivals", 300, async () => {
            const db = getDB();
            const productsCollection = db.collection("products");

            const prods = await productsCollection
                .find({})
                .project({
                    description: 0,
                    dimensions: 0,
                    reviews: 0,
                    images: 0,
                    sizeMeasurements: 0,
                    warrantyInformation: 0,
                    shippingInformation: 0,
                    returnPolicy: 0,
                    meta: 0,
                    tags: 0,
                    sku: 0,
                    weight: 0,
                    availabilityStatus: 0,
                    minimumOrderQuantity: 0
                })
                .sort({
                    _id: -1
                })
                .limit(12)
                .toArray();

            return prods.map(p => ({
                ...p,
                colors: (p.colors || []).map(c => ({
                    name: c.name,
                    hex: c.hex,
                    image: c.image && c.image !== p.thumbnail ? c.image : undefined
                }))
            }));
        });

        res.send({ products });
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" });
    }
};

const getLatestReviews = async (req, res) => {
    try {
        const reviews = await withCache("latestReviews", 15, async () => {
            const db = getDB();
            const productsCollection = db.collection("products");

            // We only look at products that have reviews to reduce the pipeline size
            return await productsCollection.aggregate([
                { $match: { "reviews.0": { $exists: true } } },
                { $unwind: "$reviews" },
                { $replaceRoot: { newRoot: { $mergeObjects: ["$reviews", { productName: "$title" }] } } },
                { $sort: { date: -1 } },
                { $limit: 10 }
            ]).toArray();
        });

        res.send({ reviews });
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" });
    }
};

const getFeaturedProducts = async (req, res) => {
    try {
        const products = await withCache("featuredProducts", 15, async () => {
            const db = getDB();
            const productsCollection = db.collection("products");

            return await productsCollection
                .find({})
                .project({
                    description: 0,
                    dimensions: 0,
                    reviews: 0,
                    images: 0,
                    sizeMeasurements: 0,
                    warrantyInformation: 0,
                    shippingInformation: 0,
                    returnPolicy: 0,
                    meta: 0,
                    tags: 0,
                    sku: 0,
                    weight: 0,
                    availabilityStatus: 0,
                    minimumOrderQuantity: 0
                })
                .sort({ rating: -1 })
                .limit(20)
                .toArray();
        });

        res.send({ products });
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" });
    }
};

module.exports = {
    createProduct,
    getAllProducts,
    getSingleProduct,
    getRelatedProducts,
    updateProduct,
    deleteProduct,
    getFlashSaleProducts,
    getBestSellingProducts,
    getNewArrivals,
    getLatestReviews,
    getFeaturedProducts
};