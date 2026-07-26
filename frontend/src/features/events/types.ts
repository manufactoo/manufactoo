export const EVENT_DIRECTIONS = ["SUBSCRIBE", "PUBLISH"] as const;
export type EventDirectionCode = (typeof EVENT_DIRECTIONS)[number];

export interface MqttEvent {
  id: number;
  name: string;
  topic: string;
  direction: EventDirectionCode;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
