const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const { ObjectId } = require("mongodb");
const { getDb, getBucket } = require("../db/mongo");
const { asyncHandler } = require("../middleware/errorHandler");
const { extractText } = require("../services/textExtraction");

const router = express.Router();

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/tiff",
]);

/**
 * POST /api/documents/upload
 * Accepts a single file under the "file" field, streams it into GridFS,
 * and records metadata in the "documents" collection.
 */
router.post(
  "/upload",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          const sizeErr = new Error("File too large");
          sizeErr.status = 400;
          sizeErr.publicMessage = `File exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit.`;
          return next(sizeErr);
        }
        err.status = 400;
        err.publicMessage = "File upload failed.";
        return next(err);
      }
      if (err) return next(err);
      next();
    });
  },
  asyncHandler(async (req, res) => {
    if (!req.file) {
      const err = new Error("No file provided");
      err.status = 400;
      err.publicMessage = 'No file was provided. Attach a file under the "file" field.';
      throw err;
    }

    if (!ALLOWED_MIME_TYPES.has(req.file.mimetype)) {
      const err = new Error("Unsupported file type");
      err.status = 400;
      err.publicMessage =
        "Unsupported file type. Allowed: PDF, Word (.doc/.docx), Excel (.xls/.xlsx), PNG, JPEG, TIFF.";
      throw err;
    }

    const db = getDb();
    const bucket = getBucket();
    const documentId = uuidv4();

    const gridfsFileId = await new Promise((resolve, reject) => {
      const uploadStream = bucket.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
        metadata: { documentId },
      });
      uploadStream.on("error", reject);
      uploadStream.on("finish", () => resolve(uploadStream.id));
      uploadStream.end(req.file.buffer);
    });

    // Extract text right away. This never throws for "needs OCR" or "unsupported
    // format" cases — extractText() represents those as a status instead, so a
    // slow or unusual file never breaks the upload response.
    const extraction = await extractText({ buffer: req.file.buffer, mimeType: req.file.mimetype });

    const documentRecord = {
      documentId,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSizeBytes: req.file.size,
      gridfsFileId: gridfsFileId.toString(),
      uploadedAt: new Date().toISOString(),
      status: extraction.status,
      extractedText: extraction.text,
      extractionNote: extraction.note,
      textExtractedAt: new Date().toISOString(),
    };

    await db.collection("documents").insertOne(documentRecord);

    res.status(201).json(documentRecord);
  })
);

/**
 * GET /api/documents
 * Lists all documents, newest first. Excludes extractedText to keep the
 * list response small — fetch a single document for its full text.
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const docs = await db
      .collection("documents")
      .find({}, { projection: { _id: 0, extractedText: 0 } })
      .sort({ uploadedAt: -1 })
      .toArray();

    res.json(docs);
  })
);

/**
 * GET /api/documents/:id
 * Returns one document's full metadata record by its documentId (uuid).
 */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const doc = await db
      .collection("documents")
      .findOne({ documentId: req.params.id }, { projection: { _id: 0 } });

    if (!doc) {
      const err = new Error("Document not found");
      err.status = 404;
      err.publicMessage = "No document found with that id.";
      throw err;
    }

    res.json(doc);
  })
);

/**
 * GET /api/documents/:id/file
 * Streams the original file back from GridFS.
 */
router.get(
  "/:id/file",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const bucket = getBucket();

    const doc = await db.collection("documents").findOne({ documentId: req.params.id });

    if (!doc) {
      const err = new Error("Document not found");
      err.status = 404;
      err.publicMessage = "No document found with that id.";
      throw err;
    }

    res.set("Content-Type", doc.mimeType);
    res.set("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.originalFilename)}"`);

    const downloadStream = bucket.openDownloadStream(new ObjectId(doc.gridfsFileId));

    downloadStream.on("error", () => {
      if (!res.headersSent) {
        res.status(404).json({ message: "File data not found in storage." });
      }
    });

    downloadStream.pipe(res);
  })
);

module.exports = router;
