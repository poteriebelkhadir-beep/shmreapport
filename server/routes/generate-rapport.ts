import type { RequestHandler } from "express";
import { consume, getClientIp } from "../lib/rateLimit";

const DEFAULT_AGENT_ID = "db2ebc26-4444-4662-9ea9-ca6024ff52dc";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_TABLES = new Set(["reports", "sessions"]);

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function safePdfUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) return undefined;
  return value.slice(0, 20).map((item) => item.slice(0, 240));
}

export const handleGenerateRapport: RequestHandler = async (req, res) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const mode = payload.mode ?? "sequence";
  const language = payload.language ?? "ar";
  const question = typeof payload.question === "string" ? payload.question.trim() : "";
  const title = typeof payload.title === "string" ? payload.title.trim() : "تقرير عام للفترة";

  if (mode !== "sequence" && mode !== "rapide") {
    res.status(400).json({ error: "Mode de rapport invalide." });
    return;
  }
  if (!question || question.length > 2000) {
    res.status(400).json({ error: "La question est obligatoire (2000 caractères maximum)." });
    return;
  }
  if (language !== "ar" && language !== "fr") {
    res.status(400).json({ error: "La langue doit être ar ou fr." });
    return;
  }
  if (title.length > 160) {
    res.status(400).json({ error: "Le titre ne peut pas dépasser 160 caractères." });
    return;
  }

  const inputs: Record<string, unknown> = { mode, question, title: title || "تقرير عام للفترة", language };

  if (mode === "sequence") {
    if (!isIsoDate(payload.date_from) || !isIsoDate(payload.date_to)) {
      res.status(400).json({ error: "date_from et date_to doivent être au format YYYY-MM-DD." });
      return;
    }
    if (payload.date_from > payload.date_to) {
      res.status(400).json({ error: "date_from doit précéder ou égaler date_to." });
      return;
    }
    inputs.date_from = payload.date_from;
    inputs.date_to = payload.date_to;
  } else {
    if (payload.date_from !== undefined || payload.date_to !== undefined) {
      if (!isIsoDate(payload.date_from) || !isIsoDate(payload.date_to)) {
        res.status(400).json({ error: "date_from et date_to doivent être renseignées ensemble au format YYYY-MM-DD." });
        return;
      }
      if (payload.date_from > payload.date_to) {
        res.status(400).json({ error: "date_from doit précéder ou égaler date_to." });
        return;
      }
      inputs.date_from = payload.date_from;
      inputs.date_to = payload.date_to;
    }

    if (typeof payload.category === "string" && payload.category.trim()) {
      if (payload.category.length > 120) {
        res.status(400).json({ error: "Le filtre de catégorie ne peut pas dépasser 120 caractères." });
        return;
      }
      inputs.category = payload.category.trim();
    }

    if (payload.tables !== undefined && typeof payload.tables !== "string") {
      res.status(400).json({ error: "tables doit être une liste CSV." });
      return;
    }
    const tables = typeof payload.tables === "string" && payload.tables.trim()
      ? [...new Set(payload.tables.split(",").map((table: string) => table.trim()).filter(Boolean))]
      : ["reports", "sessions"];
    if (!tables.length || tables.some((table: string) => !ALLOWED_TABLES.has(table))) {
      res.status(400).json({ error: "Seules les tables reports et sessions sont autorisées." });
      return;
    }
    inputs.tables = tables.join(",");
  }

  const endpointTemplate = process.env.CREAO_AGENT_RUN_URL;
  const apiKey = process.env.CREAO_API_KEY;
  if (!endpointTemplate || !apiKey) {
    res.status(503).json({ error: "La connexion à CREAO n’est pas configurée sur le serveur." });
    return;
  }

  const agentId = process.env.CREAO_AGENT_ID || DEFAULT_AGENT_ID;
  let endpoint: URL;
  try {
    endpoint = new URL(endpointTemplate.replace(/\{AGENT_ID\}/g, agentId));
  } catch {
    res.status(503).json({ error: "L’URL du service CREAO est invalide." });
    return;
  }
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) {
    res.status(503).json({ error: "L’URL du service CREAO doit utiliser HTTPS." });
    return;
  }

  const ip = getClientIp(req as unknown as { headers: Record<string, unknown>; ip?: string });
  const rateLimit = consume(`rapport:${ip}`, 60_000, 1);
  if (!rateLimit.allowed) {
    res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
    res.status(429).json({ error: "Un rapport vient déjà d’être demandé. Réessayez dans une minute." });
    return;
  }

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ inputs }),
      signal: AbortSignal.timeout(110_000),
    });
    if (!upstream.ok) {
      res.status(502).json({ error: "Le service CREAO n’a pas pu générer le rapport." });
      return;
    }

    const data = await upstream.json() as Record<string, any>;
    const pdfUrl = safePdfUrl(data.pdf_url ?? data.artifacts?.[0]?.url);
    if (!pdfUrl) {
      res.status(502).json({ error: "CREAO n’a pas retourné de lien PDF public valide." });
      return;
    }

    const summary = {
      ...data,
      ...(data.meta && typeof data.meta === "object" ? data.meta : {}),
      ...(data.summary && typeof data.summary === "object" ? data.summary : {}),
    };
    const period = summary.period && typeof summary.period === "object"
      ? summary.period
      : inputs.date_from && inputs.date_to ? { from: inputs.date_from, to: inputs.date_to } : undefined;

    res.json({
      pdf_url: pdfUrl,
      ...(period ? { period } : {}),
      ...(typeof summary.reports === "number" ? { reports: summary.reports } : {}),
      ...(typeof summary.sessions === "number" ? { sessions: summary.sessions } : {}),
      ...(typeof summary.participants_total === "number" ? { participants_total: summary.participants_total } : {}),
      ...(typeof summary.girls_ratio_pct === "number" ? { girls_ratio_pct: summary.girls_ratio_pct } : {}),
      ...(typeof summary.sessions_without_report === "number" ? { sessions_without_report: summary.sessions_without_report } : {}),
      ...(stringList(summary.recurring_negative) ? { recurring_negative: stringList(summary.recurring_negative) } : {}),
      ...(typeof summary.synthesis_used === "boolean" ? { synthesis_used: summary.synthesis_used } : {}),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      res.status(504).json({ error: "La génération du rapport a dépassé le délai autorisé. Réessayez ou configurez le traitement asynchrone CREAO." });
      return;
    }
    console.error("CREAO report generation failed:", error);
    res.status(502).json({ error: "Impossible de joindre le service CREAO." });
  }
};
