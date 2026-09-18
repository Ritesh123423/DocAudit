const express = require("express");
const cors = require("cors");
const documentsRouter = require("./routes/documents");
const { errorHandler } = require("./middleware/errorHandler");

function createApp() {
  const app = express();

  const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow tools like curl/Postman (no origin header) and any configured origin.
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        callback(new Error("Not allowed by CORS"));
      },
    })
  );

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/documents", documentsRouter);

  // 404 for anything under /api that didn't match a route above.
  app.use("/api", (req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
