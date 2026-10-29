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

const getAllProducts = async (req, res) => {

    try {
        const db = getDB();
        const productsCollection = db.collection("products");

        const limit = req.query.limit ? parseInt(req.query.limit) : null;
        const page = req.query.page ? parseInt(req.query.page) : (limit ? 1 : null);

        const search = req.query.search || "";
        const category = req.query.category || "";
        const brand = req.query.brand || "";
        const sort = req.query.sort || "";

        const query = {};

        if (search) {
            const cleanSearch = search.trim();
            if (cleanSearch) {
                const escapedSearch = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                query.$or = [
                    { title: { $regex: escapedSearch, $options: "i" } },
                    { brand: { $regex: escapedSearch, $options: "i" } },
                ];
            }
        }

        if (category) {
            const categoriesArray = category.split(",");
            if (categoriesArray.length > 1) {
                query.category = { $in: categoriesArray };
            } else {
                query.category = category;
            }
        }

        if (brand) {
            query.brand = brand;
        }

        let sortOption = { _id: -1 };

        if (sort === "asc") {
            sortOption = { price: 1 };
        } else if (sort === "desc") {
            sortOption = { price: -1 };
        }

        // Fast path for category-based queries (e.g. Related Products)
        if (category && limit && !search && !brand) {
            const catCacheKey = `cat_prods_${category}_${limit}_${sort}`;
            const catResult = await withCache(catCacheKey, 300, async () => {
                const prods = await productsCollection
                    .find({ category })
                    .project({
                        title: 1,
                        price: 1,
                        discountPercentage: 1,
                        stock: 1,
                        thumbnail: 1,
                        colors: 1,
                        category: 1,
                        badge: 1
                    })
                    .sort(sortOption)
                    .limit(limit)
                    .toArray();

                return {
                    totalProducts: prods.length,
                    products: prods.map(p => ({
                        ...p,
                        colors: (p.colors || []).map(c => ({
                            name: c.name,
                            hex: c.hex,
                            image: c.image && c.image !== p.thumbnail ? c.image : undefined
                        }))
                    }))
                };
            });

            return res.send(catResult);
        }

        const cacheKey = `products_${page}_${limit}_${search}_${category}_${brand}_${sort}`;
        const result = await withCache(cacheKey, 60, async () => {
            const bestSellingIds = await getBestSellingIds(db);
            const bestSellingIdsSet = new Set(bestSellingIds);

            const formatProducts = (prods) => prods.map(p => ({
                ...p,
                colors: (p.colors || []).map(c => ({
                    name: c.name,
                    hex: c.hex,
                    image: c.image && c.image !== p.thumbnail ? c.image : undefined
                })),
                badge: p.badge || (bestSellingIdsSet.has(p._id ? p._id.toString() : "") ? "best-seller" : null)
            }));

            if (limit) {
                const pageNum = page || 1;
                const skip = (pageNum - 1) * limit;
                const countPromise = Object.keys(query).length === 0
                    ? productsCollection.estimatedDocumentCount()
                    : productsCollection.countDocuments(query);

                const findPromise = productsCollection
                    .find(query)
                    .project({
                        description: 0,
                        dimensions: 0,
                        reviews: 0,
                        images: 0,
                        sizeMeasurements: 0,
                        warrantyInformation: 0,
                        shippingInformation: 0,
                        returnPolicy: 0,
                        tags: 0,
                        sku: 0,
                        weight: 0,
                        availabilityStatus: 0,
                        minimumOrderQuantity: 0
                    })
                    .sort(sortOption)
                    .skip(skip)
                    .limit(limit)
                    .toArray();

                const [totalProducts, products] = await Promise.all([countPromise, findPromise]);

                return {
                    totalProducts,
                    currentPage: pageNum,
                    totalPages: Math.ceil(totalProducts / limit),
                    products: formatProducts(products),
                };
            } else {
                const products = await productsCollection
                    .find(query)
                    .project({
                        description: 0,
                        dimensions: 0,
                        reviews: 0,
                        images: 0,
                        sizeMeasurements: 0,
                        warrantyInformation: 0,
                        shippingInformation: 0,
                        returnPolicy: 0,
                        tags: 0,
                        sku: 0,
                        weight: 0,
                        availabilityStatus: 0,
                        minimumOrderQuantity: 0
                    })
                    .sort(sortOption)
                    .toArray();

                return {
                    totalProducts: products.length,
                    products: formatProducts(products),
                };
            }
        });

        res.send(result);

    } catch (error) {
        console.log(error);
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
        const productsCollection = db.collection("products");

        const cacheKey = `related_${id}`;
        const related = await withCache(cacheKey, 300, async () => {
            const currentProduct = await productsCollection.findOne(buildIdQuery(id));
            const category = currentProduct?.category;

            const excludeId = currentProduct?._id || (ObjectId.isValid(id) ? new ObjectId(id) : id);
            const excludedIds = [excludeId];
            if (currentProduct?._id) excludedIds.push(currentProduct._id.toString());
            if (id) excludedIds.push(id);

            const lightProjection = {
                title: 1,
                price: 1,
                discountPercentage: 1,
                stock: 1,
                thumbnail: 1,
                colors: 1,
                category: 1,
                badge: 1
            };

            let products = [];
            if (category) {
                products = await productsCollection
                    .find({
                        _id: { $nin: excludedIds },
                        category: category
                    })
                    .project(lightProjection)
                    .sort({ _id: -1 })
                    .limit(12)
                    .toArray();
            }

            if (products.length < 8) {
                const foundIds = [...excludedIds, ...products.map(p => p._id)];
                const needed = 12 - products.length;

                const fallbackProducts = await productsCollection
                    .find({
                        _id: { $nin: foundIds },
                        stock: { $gt: 0 }
                    })
                    .project(lightProjection)
                    .sort({ _id: -1 })
                    .limit(needed)
                    .toArray();

                products = [...products, ...fallbackProducts];
            }

            return products.map(p => ({
                ...p,
                colors: (p.colors || []).map(c => ({
                    name: c.name,
                    hex: c.hex,
                    image: c.image && c.image !== p.thumbnail ? c.image : undefined
                }))
            }));
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
        const { products, maxStock } = await withCache("flashSaleProducts", 10, async () => {
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
        const result = await withCache("bestSellingProducts", 15, async () => {
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
        const products = await withCache("newArrivals", 15, async () => {
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