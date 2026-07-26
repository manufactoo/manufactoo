export type FieldType = "TEXT" | "NUMBER" | "SELECT" | "CSV";

export interface DeviceFieldDef {
  key: string;
  labelKey: string;
  type: FieldType;
  required: boolean;
  options: string[];
  placeholder: string | null;
}

export interface DeviceCatalogTransportOption {
  transport: string;
  connectionFields: DeviceFieldDef[];
}

export interface DeviceCatalogCategory {
  category: string;
  defaultDirection: string;
  directions: string[];
  transports: DeviceCatalogTransportOption[];
  settingsFields: DeviceFieldDef[];
}

export interface DeviceCatalog {
  categories: DeviceCatalogCategory[];
}

export const DEVICE_DIRECTIONS = ["INPUT", "OUTPUT", "BIDIRECTIONAL"] as const;
export type DeviceDirectionCode = (typeof DEVICE_DIRECTIONS)[number];

export interface Device {
  id: number;
  name: string;
  category: string;
  direction: string;
  transport: string;
  enabled: boolean;
  connection: Record<string, unknown>;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
