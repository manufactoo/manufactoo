import { GRID_COLUMNS, type WidgetLayout } from "./types";

// Unidad logica: "1.0" sigue valiendo 32px, igual que antes (redimensionar a
// mano/escribir numeros se sigue sintiendo igual). Lo que cambia (2026-07-28,
// a peticion del usuario: "no es mejor que el tamaño sea pixel a pixel? nunca
// queda perfecto") es que h/y ya pueden ser DECIMALES: el ajuste automatico
// por tamano de fuente calcula el alto EXACTO que hace falta, no el multiplo
// de 32 mas cercano hacia arriba.
export const ROW_HEIGHT = 32;
// Hueco visual entre widgets. Ya NO sale del "gap" del grid CSS (con filas
// finas de FINE_PX, ese gap se colaria TAMBIEN dentro de un mismo widget que
// ocupe varias filas finas -- el mismo problema de "hueco de mas" que se evito
// al bajar de 64 a 32). En vez de eso, cada widget reserva la mitad arriba y
// la mitad abajo como relleno propio (ver PART_GAP), y el grid en si no tiene
// gap vertical.
export const GRID_GAP = 8;
export const PART_GAP = GRID_GAP / 2;
// Granularidad real de las filas de CSS Grid: 1px, para que mover/redimensionar
// verticalmente sea de verdad pixel a pixel (2026-07-28, el ajuste automatico
// por tamano de fuente ya lo era; el arrastre a mano tambien lo es ahora, ver
// onMove en StationBuilderPage.tsx, que ya no redondea el movimiento vertical
// a unidades logicas enteras).
export const FINE_PX = 1;

/**
 * Estilo de contenedor del grid COMPARTIDO por el editor y el runtime, para que
 * "lo que se diseña es lo que se ve": mismas columnas (12 x 1fr, se adaptan al
 * ancho del dispositivo), mismas filas finas, mismo padding. La unica
 * diferencia entre diseno y produccion es que en produccion no hay handles de
 * arrastre; la distribucion es identica.
 */
export function gridContainerStyle(): Record<string, string | number> {
  return {
    display: "grid",
    gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`,
    gridAutoRows: `${FINE_PX}px`,
    columnGap: `${GRID_GAP}px`,
    rowGap: 0,
    padding: GRID_GAP,
  };
}

/** Convierte una coordenada logica (1.0 = 32px) al numero de filas finas de CSS Grid que ocupa/desde donde empieza. */
export function toFineRows(logicalUnits: number): number {
  return Math.round((logicalUnits * ROW_HEIGHT) / FINE_PX);
}

/** Distancia (px) entre el inicio de una columna y la siguiente, incluyendo el gap. */
export function columnStep(containerWidth: number): number {
  return (containerWidth + GRID_GAP) / GRID_COLUMNS;
}

// Px de raton por unidad logica al arrastrar verticalmente. Ya no suma
// GRID_GAP: el hueco visual ahora vive DENTRO del relleno propio de cada
// widget (PART_GAP), no como distancia extra entre una fila logica y la
// siguiente -- 1.0 unidad de alto/posicion ahora son exactamente ROW_HEIGHT
// px de verdad, sin "propina" oculta por el gap.
export const rowStep = ROW_HEIGHT;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Fila libre debajo del widget mas bajo, para apilar los nuevos sin solaparse. */
export function nextFreeRow(layouts: WidgetLayout[]): number {
  return layouts.reduce((maxBottom, l) => Math.max(maxBottom, l.y + l.h), 0);
}
