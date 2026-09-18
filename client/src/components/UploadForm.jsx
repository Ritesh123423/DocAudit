import { useRef, useState } from "react";
import { uploadDocument } from "../api.js";

export default function UploadForm({ onUploaded }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  function handleFileChange(e) {
    setError("");
    setSelectedFile(e.target.files?.[0] || null);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    setError("");
    const file = e.dataTransfer.files?.[0];
    if (file) setSelectedFile(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedFile) {
      setError("Choose a file first.");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      await uploadDocument(selectedFile);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onUploaded();
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <div
        className={`dropzone ${isDragging ? "dropzone-active" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.tiff"
          onChange={handleFileChange}
          hidden
        />
        {selectedFile ? (
          <p>{selectedFile.name}</p>
        ) : (
          <p>Drag and drop a file here, or click to choose one.</p>
        )}
        <p className="dropzone-hint">PDF, Word, Excel, PNG, JPEG, or TIFF — up to 25MB</p>
      </div>

      {error && <p className="form-error">{error}</p>}

      <button type="submit" disabled={isUploading || !selectedFile}>
        {isUploading ? "Uploading..." : "Upload document"}
      </button>
    </form>
  );
}
