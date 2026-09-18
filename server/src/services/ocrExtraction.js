// Calls the OCR.space API (free tier, no credit card required) to extract text
// from scanned PDFs and images. Uses Node's built-in fetch/FormData/Blob —
// no extra HTTP dependency needed on Node 18+.
const OCR_SPACE_ENDPOINT = "https://api.ocr.space/parse/image";

const FILETYPE_BY_MIME = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/tiff": "TIF",
};

// "reason" distinguishes OCR being unavailable (not configured, or this file
// type isn't OCR-capable) from OCR being attempted and actually failing.
// Callers use this to decide between staying at "needs_ocr" (try again later,
// once OCR is set up) versus reporting a genuine "ocr_failed".
const REASON = {
  NOT_CONFIGURED: "not_configured",
  UNSUPPORTED_TYPE: "unsupported_type",
  ATTEMPT_FAILED: "attempt_failed",
};

/**
 * Sends a file to OCR.space and returns its extracted text.
 * Never throws — network errors, API errors, and "no text found" are all
 * represented in the returned { success, text, errorMessage, reason } shape
 * so callers can always fall back gracefully.
 */
async function runOcr({ buffer, mimeType, filename }) {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      text: "",
      errorMessage: "OCR is not configured yet (OCR_SPACE_API_KEY is not set on the server).",
      reason: REASON.NOT_CONFIGURED,
    };
  }

  const filetype = FILETYPE_BY_MIME[mimeType];
  if (!filetype) {
    return {
      success: false,
      text: "",
      errorMessage: `OCR does not support file type "${mimeType}".`,
      reason: REASON.UNSUPPORTED_TYPE,
    };
  }

  const formData = new FormData();
  formData.append("apikey", apiKey);
  formData.append("language", "eng");
  formData.append("OCREngine", "2");
  formData.append("isOverlayRequired", "false");
  formData.append("scale", "true");
  formData.append("filetype", filetype);
  formData.append("file", new Blob([buffer], { type: mimeType }), filename || `document.${filetype.toLowerCase()}`);

  let response;
  try {
    response = await fetch(OCR_SPACE_ENDPOINT, { method: "POST", body: formData });
  } catch (err) {
    return {
      success: false,
      text: "",
      errorMessage: `Could not reach the OCR service: ${err.message}`,
      reason: REASON.ATTEMPT_FAILED,
    };
  }

  let body;
  try {
    body = await response.json();
  } catch (err) {
    return {
      success: false,
      text: "",
      errorMessage: "OCR service returned a response that could not be read.",
      reason: REASON.ATTEMPT_FAILED,
    };
  }

  if (!response.ok || body.IsErroredOnProcessing) {
    const apiMessage = Array.isArray(body.ErrorMessage) ? body.ErrorMessage.join(" ") : body.ErrorMessage;
    return {
      success: false,
      text: "",
      errorMessage: apiMessage || `OCR request failed with status ${response.status}.`,
      reason: REASON.ATTEMPT_FAILED,
    };
  }

  const text = (body.ParsedResults || [])
    .map((page) => page.ParsedText || "")
    .join("\n\n")
    .trim();

  if (text.length === 0) {
    return {
      success: false,
      text: "",
      errorMessage: "OCR completed but found no readable text in this document.",
      reason: REASON.ATTEMPT_FAILED,
    };
  }

  return { success: true, text, errorMessage: "", reason: null };
}

module.exports = { runOcr, FILETYPE_BY_MIME, REASON };
