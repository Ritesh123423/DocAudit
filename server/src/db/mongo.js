const { MongoClient, GridFSBucket } = require("mongodb");

let client = null;
let db = null;
let bucket = null;

/**
 * Connects to MongoDB Atlas and sets up the GridFS bucket used for file storage.
 * Call this once at server startup and reuse the returned handles.
 */
async function connectToDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy .env.example to .env and fill it in.");
  }

  client = new MongoClient(uri);
  await client.connect();

  db = client.db();
  bucket = new GridFSBucket(db, { bucketName: "documentFiles" });

  // Fail fast if the connection is not actually usable.
  await db.command({ ping: 1 });

  return { client, db, bucket };
}

function getDb() {
  if (!db) {
    throw new Error("Database not initialized. Call connectToDatabase() before getDb().");
  }
  return db;
}

function getBucket() {
  if (!bucket) {
    throw new Error("GridFS bucket not initialized. Call connectToDatabase() before getBucket().");
  }
  return bucket;
}

async function closeDatabase() {
  if (client) {
    await client.close();
  }
}

module.exports = { connectToDatabase, getDb, getBucket, closeDatabase };
