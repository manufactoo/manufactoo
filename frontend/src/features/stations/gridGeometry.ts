import { GRID_COLUMNS, type WidgetLayout } from "./types";

// Alto de fila: elegido para que un campo con etiqueta (label ~22px + control
// 36px = 58px) quepa en una fila (h=1) sin scroll. Diseno y runtime comparten
// esta constante, asi que cualquier cambio afecta a ambos por igual (WYSIWYG).
export const ROW_HEIGHT = 64;
export const GRID_GAP = 8;

/**
 * Estilo de contenedor del grid COMPARTIDO por el editor y el runtime, para que
 * "lo que se diseña es lo que se ve": mismas columnas (12 x 1fr, se adaptan al
 * ancho del dispositivo), mismas filas fijas, mismo gap y padding. La unica
 * diferencia entre diseno y produccion es que en produccion no hay handles de
 * arrastre; la distribucion es identica.
 */
export function gridContainerStyle(): Record<string, string | number> {
  return {
    display: "grid",
    gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`,
    gridAutoRows: `${ROW_HEIGHT}px`,
    gap: `${GRID_GAP}px`,
    padding: GRID_GAP,
  };
}

/** Distancia (px) entre el inicio de una columna y la siguiente, incluyendo el gap. */
export function columnStep(containerWidth: number): number {
  return (containerWidth + GRID_GAP) / GRID_COLUMNS;
}

export const rowStep = ROW_HEIGHT + GRID_GAP;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Fila libre debajo del widget mas bajo, para apilar los nuevos sin solaparse. */
export function nextFreeRow(layouts: WidgetLayout[]): number {
  return layouts.reduce((maxBottom, l) => Math.max(maxBottom, l.y + l.h), 0);
}
