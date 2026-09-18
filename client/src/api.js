const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

async function parseJsonOrThrow(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    // response had no JSON body
  }

  if (!response.ok) {
    const message = body?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return body;
}

export async function fetchDocuments() {
  const res = await fetch(`${API_BASE_URL}/api/documents`);
  return parseJsonOrThrow(res);
}

export async function fetchDocument(documentId) {
  const res = await fetch(`${API_BASE_URL}/api/documents/${documentId}`);
  return parseJsonOrThrow(res);
}

export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/api/documents/upload`, {
    method: "POST",
    body: formData,
  });
  return parseJsonOrThrow(res);
}

export function fileDownloadUrl(documentId) {
  return `${API_BASE_URL}/api/documents/${documentId}/file`;
}
