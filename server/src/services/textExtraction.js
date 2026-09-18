const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const ExcelJS = require("exceljs");
const { runOcr, REASON: OCR_REASON } = require("./ocrExtraction");

// Extraction outcomes. These become the document's "status" field.
const STATUS = {
  EXTRACTED: "extracted",
  NEEDS_OCR: "needs_ocr",
  OCR_FAILED: "ocr_failed",
  UNSUPPORTED: "extraction_unsupported",
  FAILED: "extraction_failed",
};

// File types OCR.space can actually process. A docx/xlsx with no text isn't
// something we can hand to an image/PDF OCR service, so those stay needs_ocr.
const OCR_CAPABLE_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/tiff"]);

// Below this many non-whitespace characters per PDF page, we assume the PDF
// is a scan (image-only) rather than real text, and route it to OCR.
const MIN_CHARS_PER_PAGE_FOR_TEXT_PDF = 20;

/**
 * Extracts plain text from a document buffer based on its MIME type.
 * Tries native extraction first (docx/PDF/xlsx parsing); if that comes back
 * needing OCR and the file type is one OCR.space can handle, automatically
 * falls back to OCR before giving up.
 * Never throws for "needs OCR", "unsupported format", or "OCR failed" —
 * those are expected outcomes represented in the returned status, not errors.
 * Only throws for genuine failures (corrupt file, parser crash).
 *
 * @returns {Promise<{status: string, text: string, note: string, extractionMethod: string|null}>}
 */
async function extractText({ buffer, mimeType, originalFilename }) {
  const nativeResult = await extractNative(buffer, mimeType);

  if (nativeResult.status !== STATUS.NEEDS_OCR || !OCR_CAPABLE_MIME_TYPES.has(mimeType)) {
    return { ...nativeResult, extractionMethod: nativeResult.status === STATUS.EXTRACTED ? "native" : null };
  }

  const ocrResult = await runOcr({ buffer, mimeType, filename: originalFilename });

  if (ocrResult.success) {
    return { status: STATUS.EXTRACTED, text: ocrResult.text, note: "", extractionMethod: "ocr" };
  }

  // OCR being unavailable (not configured, or this file type isn't OCR-capable)
  // is a different state from OCR being attempted and actually failing: the
  // former should stay "needs_ocr" (try again once configured), not read as
  // an error that occurred.
  const isUnavailable =
    ocrResult.reason === OCR_REASON.NOT_CONFIGURED || ocrResult.reason === OCR_REASON.UNSUPPORTED_TYPE;

  return {
    status: isUnavailable ? STATUS.NEEDS_OCR : STATUS.OCR_FAILED,
    text: "",
    note: ocrResult.errorMessage,
    extractionMethod: null,
  };
}

async function extractNative(buffer, mimeType) {
  switch (mimeType) {
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return extractFromDocx(buffer);

    case "application/msword":
      return {
        status: STATUS.UNSUPPORTED,
        text: "",
        note: "Older .doc files are not supported for text extraction yet. Please re-save this file as .docx and re-upload.",
      };

    case "application/pdf":
      return extractFromPdf(buffer);

    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return extractFromXlsx(buffer);

    case "application/vnd.ms-excel":
      return {
        status: STATUS.UNSUPPORTED,
        text: "",
        note: "Older .xls files are not supported for text extraction yet. Please re-save this file as .xlsx and re-upload.",
      };

    case "image/png":
    case "image/jpeg":
    case "image/tiff":
      return {
        status: STATUS.NEEDS_OCR,
        text: "",
        note: "This is an image file. Attempting OCR.",
      };

    default:
      return {
        status: STATUS.UNSUPPORTED,
        text: "",
        note: `No text extraction method available for file type "${mimeType}" yet.`,
      };
  }
}

async function extractFromDocx(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value || "").trim();

    if (text.length === 0) {
      return {
        status: STATUS.NEEDS_OCR,
        text: "",
        note: "No text could be extracted from this Word document. It may consist only of images. OCR does not support .docx directly, so this stays flagged rather than being auto-resolved.",
      };
    }

    return { status: STATUS.EXTRACTED, text, note: "" };
  } catch (err) {
    return {
      status: STATUS.FAILED,
      text: "",
      note: `Failed to read this Word document: ${err.message}`,
    };
  }
}

async function extractFromPdf(buffer) {
  try {
    const result = await pdfParse(buffer);
    const text = (result.text || "").trim();
    const pageCount = result.numpages || 1;
    const nonWhitespaceLength = text.replace(/\s/g, "").length;

    if (nonWhitespaceLength < MIN_CHARS_PER_PAGE_FOR_TEXT_PDF * pageCount) {
      return {
        status: STATUS.NEEDS_OCR,
        text,
        note: "This PDF appears to be a scanned document with little or no embedded text. Attempting OCR.",
      };
    }

    return { status: STATUS.EXTRACTED, text, note: "" };
  } catch (err) {
    return {
      status: STATUS.FAILED,
      text: "",
      note: `Failed to read this PDF: ${err.message}`,
    };
  }
}

async function extractFromXlsx(buffer) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheetTexts = [];

    workbook.eachSheet((worksheet) => {
      const rows = [];
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        const cellValues = [];
        row.eachCell({ includeEmpty: false }, (cell) => {
          const value = cellValueToString(cell.value);
          if (value !== "") cellValues.push(value);
        });
        if (cellValues.length > 0) rows.push(cellValues.join("\t"));
      });
      if (rows.length > 0) {
        sheetTexts.push(`--- Sheet: ${worksheet.name} ---\n${rows.join("\n")}`);
      }
    });

    const text = sheetTexts.join("\n\n").trim();

    if (text.length === 0) {
      return {
        status: STATUS.NEEDS_OCR,
        text: "",
        note: "No readable cell data was found in this workbook.",
      };
    }

    return { status: STATUS.EXTRACTED, text, note: "" };
  } catch (err) {
    return {
      status: STATUS.FAILED,
      text: "",
      note: `Failed to read this Excel file: ${err.message}`,
    };
  }
}

function cellValueToString(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    // Rich text, formula results, hyperlinks, and dates all come through as objects.
    if (value.text) return String(value.text);
    if (value.result !== undefined) return String(value.result);
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
    return "";
  }
  return String(value);
}

module.exports = { extractText, STATUS };
