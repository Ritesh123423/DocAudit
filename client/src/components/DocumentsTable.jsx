import { useState } from "react";
import { fileDownloadUrl, reprocessDocument, deleteDocument } from "../api.js";
import { getStatusInfo } from "../statusLabels.js";

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString();
}

export default function DocumentsTable({ documents, isLoading, error, onViewText, onReprocessed, onDeleted }) {
  const [reprocessingId, setReprocessingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [actionError, setActionError] = useState("");

  async function handleReprocess(documentId) {
    setReprocessingId(documentId);
    setActionError("");
    try {
      await reprocessDocument(documentId);
      onReprocessed();
    } catch (err) {
      setActionError(err.message || "Reprocessing failed.");
    } finally {
      setReprocessingId(null);
    }
  }

  async function handleDelete(documentId, filename) {
    const confirmed = window.confirm(`Delete "${filename}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(documentId);
    setActionError("");
    try {
      await deleteDocument(documentId);
      onDeleted(documentId);
    } catch (err) {
      setActionError(err.message || "Delete failed.");
    } finally {
      setDeletingId(null);
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
      {actionError && <p className="form-error">{actionError}</p>}
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
            const isDeleting = deletingId === doc.documentId;
            const rowDisabled = isReprocessing || isDeleting;
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
                    disabled={rowDisabled}
                    onClick={() => handleReprocess(doc.documentId)}
                  >
                    {isReprocessing ? "Reprocessing..." : "Reprocess"}
                  </button>
                  <button
                    type="button"
                    className="link-button link-button-danger"
                    disabled={rowDisabled}
                    onClick={() => handleDelete(doc.documentId, doc.originalFilename)}
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
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
