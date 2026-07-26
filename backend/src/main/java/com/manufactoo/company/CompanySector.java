package com.manufactoo.company;

/**
 * Solo documental: el campo CompanySettings.sector es un String libre sin
 * validacion server-side, la lista autoritativa vive en el frontend
 * (frontend/src/lib/sectors.ts) para poder traducirla por idioma.
 */
public enum CompanySector {
    METAL,
    AUTOMOTIVE,
    FOOD_BEVERAGE,
    PLASTICS,
    PHARMACEUTICAL,
    MEDICAL,
    AEROSPACE_DEFENSE,
    INDUSTRIAL,
    ELECTRONICS,
    CHEMICAL,
    TEXTILE,
    OTHER
}
