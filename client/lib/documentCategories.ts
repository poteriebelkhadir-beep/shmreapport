export interface DocumentCategory {
  code: string;
  nom_ar: string;
  nom_fr: string;
  couleur: string;
  logo_url: string;
  slogan: string;
}

export interface DocumentHeaderData {
  category: DocumentCategory | null;
  categoryLogoSrc: string | null;
}

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  { code: "baraim", nom_ar: "براعم", nom_fr: "Brâaim", couleur: "#FFCC14", logo_url: "/assets/logos/baraim.png", slogan: "البرعم مرح" },
  { code: "ashbal", nom_ar: "أشبال", nom_fr: "Ashbal", couleur: "#7DD3FC", logo_url: "/assets/logos/ashbal.png", slogan: "أقصى جهدنا" },
  { code: "zahrat", nom_ar: "زهرات", nom_fr: "Zahrat", couleur: "#BAE6FD", logo_url: "/assets/logos/zahrat.png", slogan: "أقصى جهدنا" },
  { code: "kachchaf", nom_ar: "كشاف", nom_fr: "Kachchaf", couleur: "#059669", logo_url: "/assets/logos/kachchaf.png", slogan: "دائما مستعد" },
  { code: "murchidat", nom_ar: "مرشدات", nom_fr: "Murchidat", couleur: "#10B981", logo_url: "/assets/logos/murchidat.png", slogan: "دائما مستعد" },
  { code: "kachchaf-mutaqaddim", nom_ar: "كشاف متقدم", nom_fr: "Kachchaf Mutaqaddim", couleur: "#DC2626", logo_url: "/assets/logos/kachchaf-mutaqaddim.png", slogan: "خدمة الصالح العام" },
  { code: "raidat", nom_ar: "رائدات", nom_fr: "Raïdat", couleur: "#F87171", logo_url: "/assets/logos/raidat.png", slogan: "خدمة الصالح العام" },
  { code: "jawwala", nom_ar: "جوالة", nom_fr: "Jawwala", couleur: "#FDE68A", logo_url: "/assets/logos/jawwala.png", slogan: "تنمية المجتمع" },
  { code: "dalilat", nom_ar: "دليلات", nom_fr: "Dalilat", couleur: "#FEF3C7", logo_url: "/assets/logos/dalilat.png", slogan: "" },
];

export const getDocumentCategory = (code: string | null | undefined) =>
  DOCUMENT_CATEGORIES.find((category) => category.code === code) ?? null;

export function resolveLogoUrl(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () => resolve(url);
    probe.onerror = () => resolve(null);
    probe.src = url;
  });
}

export async function resolveDocumentHeader(category: DocumentCategory | null): Promise<DocumentHeaderData> {
  return { category, categoryLogoSrc: category ? await resolveLogoUrl(category.logo_url) : null };
}
