const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const ExcelJS = require("exceljs");

// Extraction outcomes. These become the document's "status" field.
const STATUS = {
  EXTRACTED: "extracted",
  NEEDS_OCR: "needs_ocr",
  UNSUPPORTED: "extraction_unsupported",
  FAILED: "extraction_failed",
};

// Below this many non-whitespace characters per PDF page, we assume the PDF
// is a scan (image-only) rather than real text, and route it to OCR later.
const MIN_CHARS_PER_PAGE_FOR_TEXT_PDF = 20;

/**
 * Extracts plain text from a document buffer based on its MIME type.
 * Never throws for "this file needs OCR" or "we don't support this format yet" —
 * those are expected outcomes represented in the returned status, not errors.
 * Only throws for genuine failures (corrupt file, parser crash).
 *
 * @returns {Promise<{status: string, text: string, note: string}>}
 */
async function extractText({ buffer, mimeType }) {
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
        note: "This is an image file. It needs OCR to extract text (coming in the next phase).",
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
        note: "No text could be extracted from this Word document. It may consist only of images.",
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
        note: "This PDF appears to be a scanned document with little or no embedded text. It needs OCR to extract text (coming in the next phase).",
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
