const { MongoClient, ServerApiVersion } = require("mongodb");
const dns = require('dns');
const { setupIndexes } = require("../utils/setupIndexes");
const { warmUpCache } = require("../utils/cache");

dns.setServers(['8.8.8.8', '8.8.4.4']);

const dbUser = encodeURIComponent(process.env.DB_USER || "");
const dbPass = encodeURIComponent(process.env.DB_PASS || "");

// Using standard MongoDB URI to bypass DNS SRV blocking issues or environment variable
const uri = process.env.MONGODB_URI || `mongodb://${dbUser}:${dbPass}@cluster0-shard-00-00.bb41v.mongodb.net:27017,cluster0-shard-00-01.bb41v.mongodb.net:27017,cluster0-shard-00-02.bb41v.mongodb.net:27017/?authSource=admin&replicaSet=atlas-imfz1t-shard-0&tls=true`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

let db;

async function connectDB() {
    if (db) return db;
    await client.connect();
    db = client.db("fasionHouse");

    console.log("MongoDB Connected");

    // Setup Indexes
    await setupIndexes(db);

    // Warm up cache in background on startup
    warmUpCache(db).catch(err => console.error("Startup warmup failed:", err));

    return db;
}

function getDB() {
    return db;
}

module.exports = { connectDB, getDB };
