// Maps backend status values to a short label and a CSS tone class for the badge.
export const STATUS_LABELS = {
  uploaded: { label: "Uploaded", tone: "neutral" },
  extracted: { label: "Text extracted", tone: "success" },
  needs_ocr: { label: "Needs OCR", tone: "warning" },
  extraction_unsupported: { label: "Format not supported yet", tone: "warning" },
  extraction_failed: { label: "Extraction failed", tone: "error" },
};

export function getStatusInfo(status) {
  return STATUS_LABELS[status] || { label: status, tone: "neutral" };
}
