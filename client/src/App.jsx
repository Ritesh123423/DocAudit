import { useCallback, useEffect, useState } from "react";
import UploadForm from "./components/UploadForm.jsx";
import DocumentsTable from "./components/DocumentsTable.jsx";
import { fetchDocuments } from "./api.js";

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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
        <DocumentsTable documents={documents} isLoading={isLoading} error={error} />
      </section>
    </div>
  );
}
