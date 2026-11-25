import { mkdirSync, writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildDocumentBlocks, type PrintBlock } from "./client/lib/documentRenderer";
import { DocumentHeader } from "./client/components/DocumentHeader";
import { DOCUMENT_CATEGORIES } from "./client/lib/documentCategories";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c] || c);

function renderBlock(block: PrintBlock): string {
  if (block.kind === "header") {
    return renderToStaticMarkup(createElement(DocumentHeader, { category: block.category, categoryLogoSrc: block.categoryLogoSrc, baseUrl: "" }));
  }
  if (block.kind === "heading") {
    const tag = block.level === 1 ? "h2" : "h3";
    return `<${tag}>${escapeHtml(block.text)}</${tag}>`;
  }
  if (block.kind === "text") return `<p>${escapeHtml(block.text)}</p>`;
  if (block.kind === "keyvalue") {
    return `<table class="keyvalue"><tbody>${block.rows.map(([l, v]) => `<tr><th>${escapeHtml(l)}</th><td>${escapeHtml(v)}</td></tr>`).join("")}</tbody></table>`;
  }
  return `<table><thead><tr>${block.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead><tbody>${block.rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

const css = `@page{size:A4;margin:0}*{box-sizing:border-box}body{width:794px;margin:0 auto;padding:38px 72px;color:#243024;font-family:Tahoma,Arial,sans-serif;font-size:14px}h2{text-align:center;font-size:23px;margin:24px 0 12px}h3{font-size:16px;color:#624b2b;margin:20px 0 8px}p{line-height:1.9;white-space:pre-wrap;margin:10px 0}table{width:100%;border-collapse:collapse;margin:12px 0 18px}th,td{border:1px solid #d8c9a9;padding:10px 12px;text-align:right;vertical-align:top;line-height:1.7}th{background:#f5e6c8;color:#5f4a2b}.keyvalue th{width:34%}`;

async function main() {
  mkdirSync("public/__verify", { recursive: true });
  const cat = DOCUMENT_CATEGORIES[0];
  const header = { category: cat, categoryLogoSrc: cat.logo_url };
  const cases: Record<string, { values: Record<string, string>; rows: string[][] }> = {
    technical: {
      values: { authorName: "أحمد الفاروقي", activity: "خرجة الربيع", goal: "التعرف على الطبيعة", slogan: "أقصى جهدنا", date: "2026-11-20", place: "الغابة", organizingCategory: "براعم و أشبال و زهرات", mediaContact: "يوسف", targetAudience: "الأشبال", needs: "خيام" },
      rows: [["09:00", "الاستقبال"], ["10:00", "المسير"]],
    },
    proposals: {
      values: { authorName: "أحمد الفاروقي", intro: "نقترح البرنامج التالي للموسم." },
      rows: [["2026-12-01", "الحصة الأولى", "تقديم الكشافة"], ["2026-12-08", "الحصة الثانية", "عقدة الحبل"]],
    },
  };
  for (const [template, { values, rows }] of Object.entries(cases)) {
    const { name, blocks } = buildDocumentBlocks(template as "technical" | "proposals", values, rows, header);
    console.log(`\n[${template}] name = ${name}`);
    console.log(JSON.stringify(blocks.slice(1).map((b) => ("rows" in b ? [b.kind, b.rows ?? null] : [b.kind, "text" in b ? b.text : ""]))));
    const body = blocks.map(renderBlock).join("");
    writeFileSync(`public/__verify/${template}.html`, `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`);
  }
}

main();
