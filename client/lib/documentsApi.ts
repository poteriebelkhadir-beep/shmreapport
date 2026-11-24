import { API_BASE, getAuthHeaders } from "@/lib/auth";
import type { DocumentContent, TemplateId } from "@/lib/documentRenderer";

export interface SavedDocument {
  id: string;
  template_type: TemplateId;
  name: string;
  content: DocumentContent;
  created_at: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
  });
  if (response.status === 204) return undefined as T;

  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(body?.error || `Erreur serveur (${response.status}).`);
  return body as T;
}

export async function listDocuments(): Promise<SavedDocument[]> {
  const body = await request<{ documents: SavedDocument[] }>("/api/documents");
  return body.documents;
}

export async function createDocument(document: Pick<SavedDocument, "template_type" | "name" | "content">): Promise<void> {
  await request("/api/documents", { method: "POST", body: JSON.stringify(document) });
}

export async function deleteDocument(id: string): Promise<void> {
  await request(`/api/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
}
