/** Lista autoritativa de sectores. Las etiquetas viven en i18n (common.json > sectors.*). */
export const SECTORS = [
  "METAL",
  "AUTOMOTIVE",
  "FOOD_BEVERAGE",
  "PLASTICS",
  "PHARMACEUTICAL",
  "MEDICAL",
  "AEROSPACE_DEFENSE",
  "INDUSTRIAL",
  "ELECTRONICS",
  "CHEMICAL",
  "TEXTILE",
  "OTHER",
] as const;

export type SectorCode = (typeof SECTORS)[number];
