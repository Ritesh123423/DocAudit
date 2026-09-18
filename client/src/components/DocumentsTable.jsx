import { useState } from "react";
import { fileDownloadUrl, reprocessDocument } from "../api.js";
import { getStatusInfo } from "../statusLabels.js";

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString();
}

export default function DocumentsTable({ documents, isLoading, error, onViewText, onReprocessed }) {
  const [reprocessingId, setReprocessingId] = useState(null);
  const [reprocessError, setReprocessError] = useState("");

  async function handleReprocess(documentId) {
    setReprocessingId(documentId);
    setReprocessError("");
    try {
      await reprocessDocument(documentId);
      onReprocessed();
    } catch (err) {
      setReprocessError(err.message || "Reprocessing failed.");
    } finally {
      setReprocessingId(null);
    }
  }

  if (isLoading) {
    return <p>Loading documents...</p>;
  }

  if (error) {
    return <p className="form-error">{error}</p>;
  }

  if (documents.length === 0) {
    return <p className="empty-state">No documents uploaded yet.</p>;
  }

  return (
    <>
      {reprocessError && <p className="form-error">{reprocessError}</p>}
      <table className="documents-table">
        <thead>
          <tr>
            <th>Filename</th>
            <th>Status</th>
            <th>Uploaded</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const statusInfo = getStatusInfo(doc.status);
            const isReprocessing = reprocessingId === doc.documentId;
            return (
              <tr key={doc.documentId}>
                <td>{doc.originalFilename}</td>
                <td>
                  <span className={`status-badge status-${statusInfo.tone}`}>{statusInfo.label}</span>
                </td>
                <td>{formatDate(doc.uploadedAt)}</td>
                <td className="row-actions">
                  <button type="button" className="link-button" onClick={() => onViewText(doc.documentId)}>
                    View text
                  </button>
                  <a href={fileDownloadUrl(doc.documentId)} download>
                    Download
                  </a>
                  <button
                    type="button"
                    className="link-button"
                    disabled={isReprocessing}
                    onClick={() => handleReprocess(doc.documentId)}
                  >
                    {isReprocessing ? "Reprocessing..." : "Reprocess"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
