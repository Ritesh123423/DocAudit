import { useEffect, useState } from "react";
import { fetchDocument } from "../api.js";
import { getStatusInfo } from "../statusLabels.js";

export default function DocumentDetail({ documentId, onClose }) {
  const [doc, setDoc] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError("");
      try {
        const data = await fetchDocument(documentId);
        if (!cancelled) setDoc(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load this document.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const statusInfo = doc ? getStatusInfo(doc.status) : null;

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header">
          <h2>{doc ? doc.originalFilename : "Loading..."}</h2>
          <button type="button" className="link-button" onClick={onClose}>
            Close
          </button>
        </div>

        {isLoading && <p>Loading...</p>}
        {error && <p className="form-error">{error}</p>}

        {doc && (
          <>
            <p>
              <span className={`status-badge status-${statusInfo.tone}`}>{statusInfo.label}</span>
            </p>

            {doc.extractionNote && <p className="extraction-note">{doc.extractionNote}</p>}

            {doc.status === "extracted" && (
              <pre className="extracted-text">{doc.extractedText}</pre>
            )}
          </>
        )}
      </div>
    </div>
  );
}
