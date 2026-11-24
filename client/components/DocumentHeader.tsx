import type { CSSProperties } from "react";
import type { DocumentCategory } from "@/lib/documentCategories";

export const SHM_SAFI_LOGO_PATH = "/assets/logos/shm-safi.png";

const BURGUNDY = "#8B0000";
const LOGO_SIZE = 84;

const rule: CSSProperties = { height: 4, background: BURGUNDY };

const logoSlot: CSSProperties = {
  width: LOGO_SIZE,
  height: LOGO_SIZE,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const logoImage: CSSProperties = { width: "100%", height: "100%", objectFit: "contain" };

const letterPlaceholder: CSSProperties = {
  width: LOGO_SIZE,
  height: LOGO_SIZE,
  borderRadius: "50%",
  background: "#e5e7eb",
  color: "#374151",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 38,
  fontWeight: 800,
};

interface DocumentHeaderProps {
  category: DocumentCategory | null;
  categoryLogoSrc: string | null;
  baseUrl?: string;
}

export function DocumentHeader({ category, categoryLogoSrc, baseUrl = "" }: DocumentHeaderProps) {
  return (
    <>
      <div style={rule} />
      <header style={{ display: "flex", alignItems: "center", gap: 18, margin: "14px 0" }}>
        <div style={logoSlot}>
          <img src={`${baseUrl}${SHM_SAFI_LOGO_PATH}`} alt="SHM Safi" style={logoImage} />
        </div>
        <div style={{ flex: 1, textAlign: "center", lineHeight: 1.7 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>بسم الله الرحمن الرحيم</p>
          <p style={{ margin: 0 }}>الكشفية الحسنية المغربية</p>
        </div>
        <div style={logoSlot}>
          {category &&
            (categoryLogoSrc ? (
              <img src={`${baseUrl}${categoryLogoSrc}`} alt={category.nom_fr} style={logoImage} />
            ) : (
              <div style={letterPlaceholder}>{category.nom_fr.charAt(0).toUpperCase()}</div>
            ))}
        </div>
      </header>
      <div style={rule} />
    </>
  );
}
