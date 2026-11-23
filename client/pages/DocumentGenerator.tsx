import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";

type TemplateId = "hierarchy" | "technical" | "proposals" | "custom";
type PrintBlock =
  | { kind: "heading"; text: string; level: 1 | 2 }
  | { kind: "text"; text: string }
  | { kind: "keyvalue"; rows: [string, string][] }
  | { kind: "table"; columns: string[]; rows: string[][] };

interface PrintDocument {
  name: string;
  pages: PrintBlock[][];
}

const templates: { id: TemplateId; label: string; description: string; icon: string }[] = [
  { id: "hierarchy", label: "هيكلة دورية", description: "تحديد أدوار أفراد الدورية", icon: "🧭" },
  { id: "technical", label: "بطاقة تقنية", description: "تفاصيل نشاط أو خرجة", icon: "📋" },
  { id: "proposals", label: "مقترحات مرحلة", description: "برنامج الدورية للموسم", icon: "🗓️" },
  { id: "custom", label: "نموذج حر", description: "إنشاء مستند مخصص", icon: "📝" },
];

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] || character);

function renderBlock(block: PrintBlock): string {
  if (block.kind === "heading") {
    const tag = block.level === 1 ? "h2" : "h3";
    return `<${tag}>${escapeHtml(block.text)}</${tag}>`;
  }
  if (block.kind === "text") return `<p>${escapeHtml(block.text)}</p>`;
  if (block.kind === "keyvalue") {
    return `<table class="keyvalue"><tbody>${block.rows
      .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
      .join("")}</tbody></table>`;
  }
  return `<table><thead><tr>${block.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${block.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function printDocument(documentData: PrintDocument) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.title = documentData.name;
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  frame.onload = () => {
    const printWindow = frame.contentWindow;
    if (!printWindow) {
      frame.remove();
      return;
    }
    printWindow.focus();
    printWindow.print();
    window.setTimeout(() => frame.remove(), 1000);
  };
  document.body.appendChild(frame);

  const printDocument = frame.contentDocument;
  if (!printDocument) {
    frame.remove();
    return;
  }

  printDocument.open();
  printDocument.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(documentData.name)}</title><style>
    @page{size:A4;margin:0}*{box-sizing:border-box}body{width:794px;margin:0 auto;padding:38px 72px;color:#243024;font-family:Tahoma,Arial,sans-serif;font-size:14px}.bar{height:4px;background:#8b0000}.header{display:flex;align-items:center;gap:18px;margin:14px 0}.header img{width:76px;height:76px;object-fit:contain}.brand{flex:1;text-align:center;line-height:1.7}.brand p{margin:0}.brand p:first-child{font-weight:700}.sheet{min-height:1040px;page-break-after:always}.sheet:last-child{page-break-after:auto}h2{text-align:center;font-size:23px;margin:24px 0 12px}h3{font-size:16px;color:#624b2b;margin:20px 0 8px}p{line-height:1.9;white-space:pre-wrap;margin:10px 0}table{width:100%;border-collapse:collapse;margin:12px 0 18px}th,td{border:1px solid #d8c9a9;padding:10px 12px;text-align:right;vertical-align:top;line-height:1.7}th{background:#f5e6c8;color:#5f4a2b}.keyvalue th{width:34%}.footer{border-top:1px solid #e2e8f0;margin-top:30px;padding-top:12px;text-align:center;color:#8993a1;font-size:11px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
    </style></head><body><section class="sheet"><div class="bar"></div><header class="header"><img src="${escapeHtml(`${window.location.origin}/shm-logo.png`)}" alt="شعار SHM"><div class="brand"><p>بسم الله الرحمن الرحيم</p><p>الكشفية الحسنية المغربية</p><p>فوج عمر الفاروق</p></div></header><div class="bar"></div>${documentData.pages[0].map(renderBlock).join("")}<footer class="footer">تم إنشاء هذا المستند بواسطة نظام إدارة التقارير · ${new Date().toLocaleDateString("fr-FR")}</footer></section></body></html>`);
  printDocument.close();
}

export default function DocumentGenerator() {
  const navigate = useNavigate();
  const [template, setTemplate] = useState<TemplateId | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<string[][]>([["", ""]]);

  const setValue = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const setRowValue = (rowIndex: number, cellIndex: number, value: string) => {
    setRows((current) => current.map((row, index) =>
      index === rowIndex ? row.map((cell, column) => column === cellIndex ? value : cell) : row,
    ));
  };

  const chooseTemplate = (id: TemplateId) => {
    setTemplate(id);
    setValues({});
    setRows([["", "", ...(id === "proposals" ? [""] : [])]]);
  };

  const input = (key: string, label: string, placeholder = "") => (
    <label key={key} className="block space-y-2">
      <span className="block text-sm font-bold text-gray-600">{label}</span>
      <input
        value={values[key] || ""}
        placeholder={placeholder}
        onChange={(event) => setValue(key, event.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-medium outline-none transition focus:border-primary focus:bg-white"
      />
    </label>
  );

  const textarea = (key: string, label: string, rowsCount = 3) => (
    <label key={key} className="block space-y-2">
      <span className="block text-sm font-bold text-gray-600">{label}</span>
      <textarea
        rows={rowsCount}
        value={values[key] || ""}
        onChange={(event) => setValue(key, event.target.value)}
        className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-medium outline-none transition focus:border-primary focus:bg-white"
      />
    </label>
  );

  const makeDocument = () => {
    if (!template) return;
    const value = (key: string) => values[key]?.trim() || "—";
    let name = "مستند فوج عمر الفاروق";
    let blocks: PrintBlock[] = [];

    if (template === "hierarchy") {
      name = `هيكلة دورية ${value("patrolName")}`;
      blocks = [
        { kind: "heading", text: "هيكلة دورية", level: 1 },
        { kind: "heading", text: "معلومات الدورية", level: 2 },
        { kind: "keyvalue", rows: [["اسم الدورية", value("patrolName")], ["عدد الأفراد", value("memberCount")], ["الصيحة", value("cry")]] },
        { kind: "heading", text: "هيكلة الأفراد", level: 2 },
        { kind: "table", columns: ["المهمة", "الاسم"], rows: ["الرائد", "الكاتب", "مراقب الزي", "أمين المال", "المساعد"].map((role, index) => [role, value(`role-${index}`)]) },
      ];
    } else if (template === "technical") {
      name = `بطاقة تقنية ${value("patrolName")}`;
      blocks = [
        { kind: "heading", text: "بطاقة تقنية", level: 1 },
        { kind: "heading", text: "تقديم الدورية", level: 2 },
        { kind: "keyvalue", rows: [["اسم الدورية", value("patrolName")], ["رائد الدورية", value("leaderName")], ["معدّ البطاقة التقنية", value("authorName")]] },
        { kind: "heading", text: "معلومات النشاط", level: 2 },
        { kind: "keyvalue", rows: [["النشاط", value("activity")], ["الهدف من النشاط", value("goal")], ["شعار النشاط", value("slogan")], ["التاريخ", value("date")], ["المكان", value("place")], ["الفئة المنظمة", value("organizingCategory")], ["المكلف بالإعلام", value("mediaContact")], ["الفئة المستهدفة", value("targetAudience")], ["عدد المشاركين", value("participantCount")], ["الحاجيات", value("needs")]] },
        ...(rows.some((row) => row.some((cell) => cell.trim())) ? [{ kind: "heading", text: "برنامج النشاط", level: 2 } as PrintBlock, { kind: "table", columns: ["التوقيت", "الفقرة"], rows: rows.filter((row) => row.some((cell) => cell.trim())) } as PrintBlock] : []),
      ];
    } else if (template === "proposals") {
      name = `مقترحات ${value("patrolName")}`;
      blocks = [
        { kind: "heading", text: "اقتراحات المرحلة القادمة", level: 1 },
        { kind: "heading", text: "تقديم الدورية", level: 2 },
        { kind: "keyvalue", rows: [["اسم الدورية", value("patrolName")], ["عدد الأفراد", value("memberCount")], ["رائد الدورية", value("leaderName")], ["معدّ الاقتراحات", value("authorName")]] },
        ...(values.intro?.trim() ? [{ kind: "text", text: values.intro.trim() } as PrintBlock] : []),
        { kind: "table", columns: ["التاريخ", "الحصة", "التفاصيل"], rows: rows.filter((row) => row.some((cell) => cell.trim())) },
      ];
    } else {
      name = value("documentName");
      blocks = [
        { kind: "heading", text: value("documentTitle"), level: 1 },
        ...(values.customText?.trim() ? [{ kind: "text", text: values.customText.trim() } as PrintBlock] : []),
        ...(rows.some((row) => row.some((cell) => cell.trim())) ? [{ kind: "table", columns: [value("columnOne"), value("columnTwo")], rows: rows.filter((row) => row.some((cell) => cell.trim())) } as PrintBlock] : []),
      ];
    }

    printDocument({ name, pages: [blocks] });
  };

  return (
    <Layout>
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black shm-text-gradient md:text-4xl">إنشاء المستندات</h1>
            <p className="mt-3 text-sm font-medium text-gray-500">إنشاء وطباعة مستندات PDF الرسمية لفوج عمر الفاروق</p>
          </div>
          {template ? (
            <button onClick={() => setTemplate(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50">العودة إلى النماذج</button>
          ) : (
            <button onClick={() => navigate("/dashboard")} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50">لوحة القيادة</button>
          )}
        </div>

        {!template ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {templates.map((item) => (
              <button key={item.id} onClick={() => chooseTemplate(item.id)} className="shm-card group text-right hover:-translate-y-1">
                <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl shm-gradient text-2xl text-white">{item.icon}</span>
                <span className="block text-xl font-black text-gray-800">{item.label}</span>
                <span className="mt-2 block text-sm font-medium text-gray-500">{item.description}</span>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); makeDocument(); }} className="space-y-6">
            {template === "hierarchy" && (
              <>
                <section className="shm-card space-y-4"><h2 className="text-lg font-black text-gray-800">معلومات الدورية</h2>{input("patrolName", "اسم الدورية")}{input("memberCount", "عدد الأفراد")}{input("cry", "الصيحة")}</section>
                <section className="shm-card space-y-4"><h2 className="text-lg font-black text-gray-800">هيكلة الأفراد</h2>{["الرائد", "الكاتب", "مراقب الزي", "أمين المال", "المساعد"].map((role, index) => input(`role-${index}`, role))}</section>
              </>
            )}
            {template === "technical" && (
              <>
                <section className="shm-card grid gap-4 sm:grid-cols-2"><h2 className="sm:col-span-2 text-lg font-black text-gray-800">تقديم الدورية</h2>{input("patrolName", "اسم الدورية")}{input("leaderName", "رائد الدورية")}{input("authorName", "معدّ البطاقة التقنية")}</section>
                <section className="shm-card grid gap-4 sm:grid-cols-2"><h2 className="sm:col-span-2 text-lg font-black text-gray-800">معلومات النشاط</h2>{input("activity", "النشاط")}{textarea("goal", "الهدف من النشاط", 2)}{input("slogan", "شعار النشاط")}{input("date", "التاريخ")}{input("place", "المكان")}{input("organizingCategory", "الفئة المنظمة")}{input("mediaContact", "المكلف بالإعلام")}{textarea("targetAudience", "الفئة المستهدفة", 2)}{input("participantCount", "عدد المشاركين")}{textarea("needs", "الحاجيات", 2)}</section>
                <section className="shm-card space-y-4"><h2 className="text-lg font-black text-gray-800">برنامج النشاط (اختياري)</h2>{rows.map((row, rowIndex) => <div key={rowIndex} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">{row.map((cell, cellIndex) => <input key={cellIndex} value={cell} placeholder={cellIndex === 0 ? "التوقيت" : "الفقرة"} onChange={(event) => setRowValue(rowIndex, cellIndex, event.target.value)} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-primary" />)}<button type="button" onClick={() => setRows((current) => current.filter((_, index) => index !== rowIndex))} className="rounded-xl border border-gray-200 px-3 font-bold text-gray-500">حذف</button></div>)}<button type="button" onClick={() => setRows((current) => [...current, ["", ""]])} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600">+ إضافة فقرة</button></section>
              </>
            )}
            {template === "proposals" && (
              <>
                <section className="shm-card grid gap-4 sm:grid-cols-2"><h2 className="sm:col-span-2 text-lg font-black text-gray-800">تقديم الدورية</h2>{input("patrolName", "اسم الدورية")}{input("memberCount", "عدد الأفراد")}{input("leaderName", "رائد الدورية")}{input("authorName", "معدّ الاقتراحات")}{textarea("intro", "مقدمة (اختياري)", 3)}</section>
                <section className="shm-card space-y-4"><h2 className="text-lg font-black text-gray-800">البرنامج المقترح</h2>{rows.map((row, rowIndex) => <div key={rowIndex} className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto]">{row.map((cell, cellIndex) => <input key={cellIndex} value={cell} placeholder={["التاريخ", "الحصة", "التفاصيل"][cellIndex]} onChange={(event) => setRowValue(rowIndex, cellIndex, event.target.value)} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-primary" />)}<button type="button" onClick={() => setRows((current) => current.filter((_, index) => index !== rowIndex))} className="rounded-xl border border-gray-200 px-3 font-bold text-gray-500">حذف</button></div>)}<button type="button" onClick={() => setRows((current) => [...current, ["", "", ""]])} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600">+ إضافة حصة</button></section>
              </>
            )}
            {template === "custom" && (
              <>
                <section className="shm-card space-y-4"><h2 className="text-lg font-black text-gray-800">معلومات المستند</h2>{input("documentName", "اسم الملف")}{input("documentTitle", "العنوان الرئيسي")}{textarea("customText", "فقرة نصية", 4)}</section>
                <section className="shm-card space-y-4"><h2 className="text-lg font-black text-gray-800">جدول مخصص (اختياري)</h2><div className="grid gap-3 sm:grid-cols-2">{input("columnOne", "عنوان العمود الأول")}{input("columnTwo", "عنوان العمود الثاني")}</div>{rows.map((row, rowIndex) => <div key={rowIndex} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">{row.map((cell, cellIndex) => <input key={cellIndex} value={cell} placeholder={`قيمة ${cellIndex + 1}`} onChange={(event) => setRowValue(rowIndex, cellIndex, event.target.value)} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-primary" />)}<button type="button" onClick={() => setRows((current) => current.filter((_, index) => index !== rowIndex))} className="rounded-xl border border-gray-200 px-3 font-bold text-gray-500">حذف</button></div>)}<button type="button" onClick={() => setRows((current) => [...current, ["", ""]])} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600">+ إضافة سطر</button></section>
              </>
            )}
            <button type="submit" className="w-full rounded-2xl shm-gradient px-6 py-4 font-black text-white shadow-lg shadow-primary/20 sm:w-auto">إنشاء PDF</button>
          </form>
        )}
      </div>
    </Layout>
  );
}
