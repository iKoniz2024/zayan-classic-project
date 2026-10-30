const cache = new Map();
const inFlight = new Map();

/**
 * Caches the result of an asynchronous function in memory with
 * Stale-While-Revalidate and Promise coalescing.
 * 
 * @param {string} key - The unique cache key for the query
 * @param {number} ttlSeconds - Time-to-live in seconds
 * @param {Function} fetchFunction - The async function that fetches the data if it's not cached
 * @returns {Promise<any>} - The cached or freshly fetched data
 */
const withCache = async (key, ttlSeconds, fetchFunction) => {
    const now = Date.now();
    const cachedItem = cache.get(key);

    // 1. Fresh cache hit: Return immediately
    if (cachedItem && cachedItem.expiry > now) {
        return cachedItem.data;
    }

    // 2. Stale cache hit: Return stale data immediately (0ms) and refresh in background
    if (cachedItem && cachedItem.data !== undefined) {
        if (!inFlight.has(key)) {
            const refreshPromise = (async () => {
                try {
                    const freshData = await fetchFunction();
                    cache.set(key, {
                        data: freshData,
                        expiry: Date.now() + (ttlSeconds * 1000)
                    });
                } catch (err) {
                    console.error(`Background cache refresh failed for ${key}:`, err.message);
                } finally {
                    inFlight.delete(key);
                }
            })();
            inFlight.set(key, refreshPromise);
        }
        return cachedItem.data;
    }

    // 3. Cache miss: If already in flight, await the existing promise
    if (inFlight.has(key)) {
        return await inFlight.get(key);
    }

    // 4. Cache miss: Fetch and store
    const fetchPromise = (async () => {
        try {
            const data = await fetchFunction();
            cache.set(key, {
                data,
                expiry: Date.now() + (ttlSeconds * 1000)
            });
            return data;
        } finally {
            inFlight.delete(key);
        }
    })();

    inFlight.set(key, fetchPromise);
    return await fetchPromise;
};

/**
 * Warm up cache for products, orders, categories, banners, and homepage feeds in parallel.
 * @param {any} db - The MongoDB Database instance
 */
const warmUpCache = async (db) => {
    if (!db) return;
    try {
        console.log("Warming up cache for products, orders, categories, banners, and homepage feeds...");

        const bannersCollection = db.collection("banners");
        const categoriesCollection = db.collection("categories");
        const productsCollection = db.collection("products");
        const ordersCollection = db.collection("orders");
        const settingsCollection = db.collection("settings");

        const lightProjection = {
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
        };

        await Promise.allSettled([
            // 1. Warm up Banners
            withCache("banners", 300, async () => {
                return await bannersCollection.find({}).sort({ createdAt: -1 }).toArray();
            }),

            // 2. Warm up Categories with Counts (Used by Homepage Categories)
            withCache("categoriesWithCounts", 300, async () => {
                const categories = await categoriesCollection.find().sort({ createdAt: -1 }).toArray();
                const countResult = await productsCollection.aggregate([
                    { $group: { _id: "$category", count: { $sum: 1 } } }
                ]).toArray();
                const countMap = new Map(countResult.map(r => [r._id, r.count]));
                return categories.map(parent => {
                    let totalCount = 0;
                    for (const child of parent.children ?? []) {
                        for (const catSlug of child.categories ?? []) {
                            totalCount += countMap.get(catSlug) ?? 0;
                        }
                    }
                    return { ...parent, productCount: totalCount };
                });
            }),

            // 3. Warm up New Arrivals (Used by Homepage New Arrivals)
            withCache("newArrivals", 300, async () => {
                const prods = await productsCollection
                    .find({})
                    .project(lightProjection)
                    .sort({ _id: -1 })
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
            }),

            // 4. Warm up Flash Sale (Used by Homepage Flash Sale)
            withCache("flashSaleProducts", 300, async () => {
                let products = await productsCollection
                    .aggregate([
                        { $match: { discountPercentage: { $gt: 0 }, stock: { $gt: 0 } } },
                        { $project: lightProjection },
                        { $sort: { discountPercentage: -1 } },
                        { $limit: 12 }
                    ])
                    .toArray();

                if (products.length < 8) {
                    const existingIds = products.map(p => p._id);
                    const needed = 12 - products.length;
                    const extra = await productsCollection
                        .find({ _id: { $nin: existingIds }, stock: { $gt: 0 } })
                        .project(lightProjection)
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
            }),

            // 5. Warm up Best Selling Products
            withCache("bestSellingProducts", 300, async () => {
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
                        { $group: { _id: "$productId", totalSold: { $sum: "$quantity" } } },
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
                                newRoot: { $mergeObjects: ["$product", { totalSold: "$totalSold" }] }
                            }
                        },
                        { $project: lightProjection }
                    ])
                    .toArray();

                if (products.length < 8) {
                    const existingIds = products.map(p => p._id);
                    const needed = 12 - products.length;
                    const extraProducts = await productsCollection
                        .find({ _id: { $nin: existingIds } })
                        .project(lightProjection)
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
            }),

            // 6. Warm up Site Settings
            withCache("siteSettings", 300, async () => {
                const doc = await settingsCollection.findOne({ key: "site_settings" });
                return doc?.value || null;
            }),

            // 7. Warm up Products Catalog (Used for instantaneous search & filtering)
            withCache("productsCatalog", 300, async () => {
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

                return prods.map(p => ({
                    ...p,
                    colors: (p.colors || []).map(c => ({
                        name: c.name,
                        hex: c.hex,
                        image: c.image && c.image !== p.thumbnail ? c.image : undefined
                    }))
                }));
            }),
        ]);

        console.log("Cache warming completed successfully!");
    } catch (error) {
        console.error("Error warming up cache:", error);
    }
};

/**
 * Clears a specific cache key or all cache if no key provided.
 * @param {string} [key] 
 */
const clearCache = (key) => {
    if (key) {
        cache.delete(key);
    } else {
        cache.clear();
    }
};

module.exports = {
    withCache,
    clearCache,
    warmUpCache
};
