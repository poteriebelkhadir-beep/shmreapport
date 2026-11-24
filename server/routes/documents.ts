import { RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../lib/supabase";

const TEMPLATE_IDS = ["hierarchy", "technical", "proposals", "custom"];
const MAX_NAME_LENGTH = 200;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOCUMENT_COLUMNS = "id, template_type, name, content, url, created_at";
const STORAGE_BUCKET = "generated-documents";

const storagePath = (id: string) => `${id}.pdf`;

const isStringRecord = (value: unknown): value is Record<string, string> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((item) => typeof item === "string");

const isStringGrid = (value: unknown): value is string[][] =>
  Array.isArray(value) &&
  value.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === "string"));

export const handleListDocuments: RequestHandler = async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("generated_documents")
    .select(DOCUMENT_COLUMNS)
    .eq("user_id", req.rapport_user!.sub)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Documents list error:", error);
    res.status(500).json({ error: "تعذر تحميل المستندات." });
    return;
  }

  res.json({ documents: data ?? [] });
};

export const handleCreateDocument: RequestHandler = async (req, res) => {
  const body = (req.body ?? {}) as { template_type?: unknown; name?: unknown; content?: unknown; pdf?: unknown };
  const templateType = body.template_type;
  const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME_LENGTH) : "";
  const content = body.content as { values?: unknown; rows?: unknown } | undefined;
  const pdf = typeof body.pdf === "string" ? Buffer.from(body.pdf, "base64") : null;

  if (
    typeof templateType !== "string" ||
    !TEMPLATE_IDS.includes(templateType) ||
    !name ||
    !isStringRecord(content?.values) ||
    !isStringGrid(content?.rows) ||
    !pdf ||
    pdf.subarray(0, 5).toString("latin1") !== "%PDF-"
  ) {
    res.status(400).json({ error: "بيانات المستند غير صالحة." });
    return;
  }

  const id = randomUUID();
  const bucket = supabaseAdmin.storage.from(STORAGE_BUCKET);

  const { error: uploadError } = await bucket.upload(storagePath(id), pdf, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploadError) {
    console.error("Document upload error:", uploadError);
    res.status(500).json({ error: "تعذر حفظ ملف PDF." });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("generated_documents")
    .insert({
      id,
      user_id: req.rapport_user!.sub,
      template_type: templateType,
      name,
      url: bucket.getPublicUrl(storagePath(id)).data.publicUrl,
      content: { values: content.values, rows: content.rows },
    })
    .select(DOCUMENT_COLUMNS)
    .single();

  if (error) {
    console.error("Document insert error:", error);
    await bucket.remove([storagePath(id)]);
    res.status(500).json({ error: "تعذر حفظ المستند." });
    return;
  }

  res.status(201).json({ document: data });
};

export const handleDeleteDocument: RequestHandler = async (req, res) => {
  const id = req.params.id as string;
  if (!UUID_PATTERN.test(id)) {
    res.status(400).json({ error: "معرّف المستند غير صالح." });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("generated_documents")
    .delete()
    .eq("id", id)
    .eq("user_id", req.rapport_user!.sub)
    .select("id");

  if (error) {
    console.error("Document delete error:", error);
    res.status(500).json({ error: "تعذر حذف المستند." });
    return;
  }

  if (!data?.length) {
    res.status(404).json({ error: "المستند غير موجود." });
    return;
  }

  const { error: removeError } = await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([storagePath(id)]);
  if (removeError) console.error("Document file delete error:", removeError);

  res.status(204).end();
};
