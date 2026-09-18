import { fileDownloadUrl } from "../api.js";

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString();
}

export default function DocumentsTable({ documents, isLoading, error }) {
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
        {documents.map((doc) => (
          <tr key={doc.documentId}>
            <td>{doc.originalFilename}</td>
            <td>
              <span className={`status-badge status-${doc.status}`}>{doc.status}</span>
            </td>
            <td>{formatDate(doc.uploadedAt)}</td>
            <td>
              <a href={fileDownloadUrl(doc.documentId)} download>
                Download
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
