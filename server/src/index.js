require("dotenv").config();
const { createApp } = require("./app");
const { connectToDatabase } = require("./db/mongo");

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await connectToDatabase();
    console.log("Connected to MongoDB.");

    const app = createApp();
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

start();
