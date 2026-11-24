import { RequestHandler } from "express";
import { supabaseAdmin } from "../lib/supabase";

const TEMPLATE_IDS = ["hierarchy", "technical", "proposals", "custom"];
const MAX_NAME_LENGTH = 200;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOCUMENT_COLUMNS = "id, template_type, name, content, created_at";

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
    .from("documents")
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
  const body = (req.body ?? {}) as { template_type?: unknown; name?: unknown; content?: unknown };
  const templateType = body.template_type;
  const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME_LENGTH) : "";
  const content = body.content as { values?: unknown; rows?: unknown } | undefined;

  if (
    typeof templateType !== "string" ||
    !TEMPLATE_IDS.includes(templateType) ||
    !name ||
    !isStringRecord(content?.values) ||
    !isStringGrid(content?.rows)
  ) {
    res.status(400).json({ error: "بيانات المستند غير صالحة." });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("documents")
    .insert({
      user_id: req.rapport_user!.sub,
      template_type: templateType,
      name,
      content: { values: content.values, rows: content.rows },
    })
    .select(DOCUMENT_COLUMNS)
    .single();

  if (error) {
    console.error("Document insert error:", error);
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
    .from("documents")
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

  res.status(204).end();
};
