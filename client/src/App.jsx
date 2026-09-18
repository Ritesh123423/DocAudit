import { useCallback, useEffect, useState } from "react";
import UploadForm from "./components/UploadForm.jsx";
import DocumentsTable from "./components/DocumentsTable.jsx";
import DocumentDetail from "./components/DocumentDetail.jsx";
import { fetchDocuments } from "./api.js";

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
    } catch (err) {
      setError(err.message || "Could not load documents.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Used after a reprocess completes: refreshes the list without flashing
  // the "Loading documents..." state over the table the user is looking at.
  const refreshDocumentsSilently = useCallback(async () => {
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
    } catch (err) {
      setError(err.message || "Could not refresh documents.");
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  return (
    <div className="page">
      <header>
        <h1>Audit Document Analyzer</h1>
        <p className="subtitle">Upload agreements, SOPs, and financial documents for review.</p>
      </header>

      <section className="card">
        <h2>Upload a document</h2>
        <UploadForm onUploaded={loadDocuments} />
      </section>

      <section className="card">
        <h2>Documents</h2>
        <DocumentsTable
          documents={documents}
          isLoading={isLoading}
          error={error}
          onViewText={setSelectedDocumentId}
          onReprocessed={refreshDocumentsSilently}
        />
      </section>

      {selectedDocumentId && (
        <DocumentDetail documentId={selectedDocumentId} onClose={() => setSelectedDocumentId(null)} />
      )}
    </div>
  );
}
