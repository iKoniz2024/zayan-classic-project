const setupIndexes = async (db) => {
    try {
        console.log("Setting up MongoDB indexes...");

        const productsCollection = db.collection("products");
        const ordersCollection = db.collection("orders");

        // Indexes for products collection
        // 1. Index for getAllProducts (search, category, brand, sorting)
        // Indexes for filtering
        await productsCollection.createIndex({ category: 1 });
        await productsCollection.createIndex({ brand: 1 });
        // Indexes for sorting
        await productsCollection.createIndex({ "meta.createdAt": -1 });
        await productsCollection.createIndex({ price: 1 });
        await productsCollection.createIndex({ price: -1 });

        // 2. Indexes for getFlashSaleProducts
        await productsCollection.createIndex({ discountPercentage: -1 });

        // 3. Indexes for getFeaturedProducts
        await productsCollection.createIndex({ rating: -1 });

        // Indexes for orders collection
        // 1. Index for getBestSellingProducts aggregation
        await ordersCollection.createIndex({ "items.productId": 1 });
        await ordersCollection.createIndex({ createdAt: -1 });
        await ordersCollection.createIndex({ orderStatus: 1, createdAt: -1 });

        console.log("MongoDB indexes setup successfully.");
    } catch (error) {
        console.error("Error setting up MongoDB indexes:", error);
    }
};

module.exports = { setupIndexes };
