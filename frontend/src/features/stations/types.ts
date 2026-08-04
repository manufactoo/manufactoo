export type WidgetFieldType = "TEXT" | "NUMBER" | "SELECT" | "CHECKBOX";

export interface WidgetFieldDef {
  key: string;
  labelKey: string;
  type: WidgetFieldType;
  required: boolean;
  options: string[];
  placeholder: string | null;
}

export type WidgetCategoryCode = "DATA" | "DISPLAY";

export interface WidgetDescriptor {
  type: string;
  category: WidgetCategoryCode;
  requiresBinding: boolean;
  supportsDataSource: boolean;
  configFields: WidgetFieldDef[];
}

export interface WidgetCatalog {
  widgets: WidgetDescriptor[];
  dataSources: string[];
  lookupColumns: Record<string, string[]>;
  displayColumns: Record<string, string[]>;
}

export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StaticOption {
  value: string;
  label: string;
}

export interface WidgetDataSource {
  type?: string;
  staticOptions?: StaticOption[];
}

/**
 * Apariencia visual generica de un widget (config.style dentro del JSONB
 * "config" ya existente -- no es un dato especifico de un tipo de widget, es
 * transversal a todos, asi que no vive en el catalogo de configFields del
 * backend). Aplicable a CUALQUIER widget, no solo al texto tecleado: tamano,
 * negrita, alineacion, color de texto y color de fondo del widget entero.
 */
export interface WidgetStyle {
  fontSize?: "SM" | "MD" | "LG" | "XL" | "XXL";
  bold?: boolean;
  align?: "LEFT" | "CENTER" | "RIGHT";
  textColor?: string;
  backgroundColor?: string;
  /** Solo para partes opcionales (p. ej. la etiqueta encima de un campo): el contenido principal del widget nunca es ocultable. */
  hidden?: boolean;
}

export interface Widget {
  id?: number;
  widgetType: string;
  label: string;
  bindingKey: string | null;
  required: boolean;
  sourceDeviceId: number | null;
  sourceEventId: number | null;
  config: Record<string, unknown>;
  dataSource: WidgetDataSource;
  layout: WidgetLayout;
  orderIndex: number;
}

export interface DataSourceColumn {
  key: string;
  labelKey: string;
}

export interface DataSourceTable {
  columns: DataSourceColumn[];
  rows: Record<string, unknown>[];
}

export interface TraceRecord {
  id: number;
  stationId: number;
  screenId: number | null;
  capturedData: Record<string, unknown>;
  /** Resultado OK/NG del paso, o null si la estacion no usa ese concepto -- ver BUTTON action=SUBMIT. */
  result: string | null;
  createdAt: string;
}

export interface Screen {
  id?: number;
  title: string;
  orderIndex: number;
  widgets: Widget[];
}

export interface Station {
  id: number;
  name: string;
  description: string;
  enabled: boolean;
  screens: Screen[];
  /** Posiciones fisicas de la estacion (p. ej. "R1", "Feeder-A"), definidas por el diseñador -- ver MaterialsDialog/StationMaterialsWidget. */
  positions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DataSourceOption {
  value: string;
  label: string;
}

export const GRID_COLUMNS = 12;

/**
 * Un lote/serie de Odoo activo ahora mismo en una estacion -- un dato de la
 * ESTACION, no de ningun widget ni "ranura" con nombre. Pueden coexistir
 * varios lotes distintos, incluso del mismo producto (name). Su identidad es
 * el propio lote (value = id de Odoo), no una clave elegida por nadie.
 */
export interface MaterialLoad {
  id: number;
  name: string;
  value: string;
  label: string;
  /** Posicion fisica de la estacion donde se cargo (una de Station.positions), o null si no tiene. */
  position: string | null;
  loadedAt: string;
}

/** Igual que MaterialLoad, pero con la estacion -- para la vista cruzada de toda la instalacion. */
export interface StationMaterialLoad {
  id: number;
  stationId: number;
  stationName: string;
  name: string;
  value: string;
  label: string;
  position: string | null;
  loadedAt: string;
}

export interface GenealogyStep {
  recordId: number;
  stationId: number;
  stationName: string;
  createdAt: string;
  capturedData: Record<string, unknown>;
  /** Valor de su identificador de ruta en ese momento, o null si no tenia ninguno aplicado. */
  identifierValue: string | null;
}

/** Resultado de buscar un codigo en ambas direcciones a la vez -- ver GenealogyPage. */
export interface GenealogySearchResult {
  asUnit: GenealogyStep[];
  asMaterial: GenealogyStep[];
}

/** Pagina de los registros de trazabilidad mas recientes de toda la app -- ver GenealogyPage. */
export interface GenealogyRecentPage {
  items: GenealogyStep[];
  page: number;
  size: number;
  totalItems: number;
}

export interface Player {
  id: number;
  name: string;
  hostname: string | null;
  stationId: number | null;
  stationName: string | null;
  playerVersion: string | null;
  lastSeenAt: string | null;
  pendingPairing: boolean;
  pairingCode: string | null;
  paired: boolean;
}
