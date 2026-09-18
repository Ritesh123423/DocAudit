import { fileDownloadUrl } from "../api.js";
import { getStatusInfo } from "../statusLabels.js";

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString();
}

export default function DocumentsTable({ documents, isLoading, error, onViewText }) {
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
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
