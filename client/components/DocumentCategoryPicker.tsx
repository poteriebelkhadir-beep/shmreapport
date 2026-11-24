import { useState } from "react";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@/lib/documentCategories";

const isDarkColor = (hex: string) => {
  const value = parseInt(hex.slice(1), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return 0.299 * red + 0.587 * green + 0.114 * blue < 150;
};

function CategoryLogo({ category }: { category: DocumentCategory }) {
  const [failed, setFailed] = useState(false);
  const className = "h-14 w-14 shrink-0 rounded-full bg-white/80 object-contain p-1";

  if (failed) {
    return <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gray-200 text-xl font-black text-gray-700">{category.nom_fr.charAt(0).toUpperCase()}</span>;
  }

  return <img src={category.logo_url} alt={category.nom_fr} onError={() => setFailed(true)} className={className} />;
}

function CategoryCard({ category, onSelect }: { category: DocumentCategory; onSelect: (code: string) => void }) {
  return (
    <button type="button" onClick={() => onSelect(category.code)} className="shm-card overflow-hidden p-0 text-right transition hover:-translate-y-0.5">
      <div
        className="flex items-center gap-4 px-5 py-4"
        style={{ backgroundColor: category.couleur, color: isDarkColor(category.couleur) ? "#ffffff" : "#1f2937" }}
      >
        <CategoryLogo category={category} />
        <span className="text-xl font-black">{category.nom_ar}</span>
      </div>
      <div className="flex items-center justify-between px-5 py-3 text-sm font-bold text-gray-600">
        <span>فئة {category.nom_fr}</span>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gray-100 text-gray-700">{category.nom_fr.charAt(0)}</span>
      </div>
    </button>
  );
}

export default function DocumentCategoryPicker({ onSelect }: { onSelect: (code: string) => void }) {
  return (
    <section className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-black text-gray-800">اختر الفئة</h2>
        <p className="mt-2 text-sm font-medium text-gray-500">يُضاف شعار الفئة واسمها تلقائيًا إلى كل مستند</p>
      </div>
      <div className="mx-auto flex max-w-md flex-col gap-4">
        {DOCUMENT_CATEGORIES.map((category) => (
          <CategoryCard key={category.code} category={category} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}
