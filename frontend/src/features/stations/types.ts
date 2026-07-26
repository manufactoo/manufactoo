export type WidgetFieldType = "TEXT" | "NUMBER" | "SELECT";

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
  createdAt: string;
  updatedAt: string;
}

export interface DataSourceOption {
  value: string;
  label: string;
}

export const GRID_COLUMNS = 12;

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
