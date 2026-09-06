const cache = new Map();

/**
 * Caches the result of an asynchronous function in memory.
 * 
 * @param {string} key - The unique cache key for the query
 * @param {number} ttlSeconds - Time-to-live in seconds
 * @param {Function} fetchFunction - The async function that fetches the data if it's not cached
 * @returns {Promise<any>} - The cached or freshly fetched data
 */
const withCache = async (key, ttlSeconds, fetchFunction) => {
    const now = Date.now();
    const cachedItem = cache.get(key);

    if (cachedItem && cachedItem.expiry > now) {
        return cachedItem.data;
    }

    // Cache miss or expired, fetch new data
    const data = await fetchFunction();
    
    // Store in cache
    cache.set(key, {
        data,
        expiry: now + (ttlSeconds * 1000)
    });

    return data;
};

/**
 * Warm up cache for products, orders, categories, and banners.
 * @param {any} db - The MongoDB Database instance
 */
const warmUpCache = async (db) => {
    if (!db) return;
    try {
        console.log("Warming up cache for products, orders, categories, and banners...");

        // 1. Warm up Banners
        const bannersCollection = db.collection("banners");
        await withCache("banners", 15, async () => {
            return await bannersCollection.find({}).sort({ createdAt: -1 }).toArray();
        });

        // 2. Warm up Categories
        const categoriesCollection = db.collection("categories");
        await withCache("categories_null_null_", 15, async () => {
            return await categoriesCollection.find({}).sort({ createdAt: -1 }).toArray();
        });

        // 3. Warm up Orders
        const ordersCollection = db.collection("orders");
        await withCache("orders_null_null_", 15, async () => {
            const orders = await ordersCollection.find({})
                .project({
                    orderStatus: 1,
                    paymentMethod: 1,
                    paymentStatus: 1,
                    totalPrice: 1,
                    totalItems: 1,
                    deliveryArea: 1,
                    shippingAddress: {
                        fullName: 1,
                        phone: 1,
                        address: 1
                    },
                    createdAt: 1,
                    updatedAt: 1,
                    items: {
                        $map: {
                            input: { $ifNull: ["$items", []] },
                            as: "item",
                            in: {
                                title: "$$item.title",
                                thumbnail: "$$item.thumbnail",
                                quantity: "$$item.quantity",
                                price: "$$item.price",
                                subtotal: "$$item.subtotal"
                            }
                        }
                    }
                })
                .sort({ createdAt: -1 })
                .toArray();
            return {
                totalOrders: orders.length,
                orders
            };
        });

        // 4. Warm up Products
        const productsCollection = db.collection("products");
        await withCache("products_null_null____", 15, async () => {
            const products = await productsCollection.find({})
                .project({ 
                    description: 0, 
                    dimensions: 0, 
                    reviews: 0, 
                    images: 0, 
                    sizeMeasurements: 0, 
                    warrantyInformation: 0, 
                    shippingInformation: 0, 
                    returnPolicy: 0, 
                    sizes: 0,
                    colors: 0,
                    tags: 0,
                    sku: 0,
                    weight: 0,
                    availabilityStatus: 0,
                    minimumOrderQuantity: 0
                })
                .sort({ _id: -1 })
                .toArray();
            return {
                totalProducts: products.length,
                products
            };
        });

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
