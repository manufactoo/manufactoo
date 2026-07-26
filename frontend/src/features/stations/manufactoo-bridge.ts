/**
 * Contrato entre el runtime web de una estacion y el Manufactoo Player
 * (Electron). Cuando la pantalla se abre en un navegador normal, `window.manufactoo`
 * no existe y todo funciona igual que hasta ahora (campo de escaneo manual,
 * emulacion de teclado). Cuando se abre DENTRO del Player, este objeto lo
 * inyecta el proceso principal via preload/contextBridge y da acceso a los
 * dispositivos locales (puerto serie, MQTT, impresoras) sin que el runtime
 * necesite saber nada de Node/Electron.
 *
 * IMPORTANTE (compatibilidad hacia delante): este contrato es ADITIVO. Anadir
 * una capacidad nueva = anadir un metodo/campo nuevo, nunca cambiar uno
 * existente. `capabilities` es una lista abierta de strings (no un enum
 * cerrado) precisamente para que un Player viejo y un MES nuevo (o al reves)
 * seguir funcionando juntos sin romperse: el runtime comprueba capacidades
 * ("hasCapability") en vez de asumir una version exacta del Player.
 */
export interface ManufactooBridge {
  /** Version de ESTE contrato (no la version del Player). Solo sube en cambios incompatibles. */
  apiVersion: string;
  /** Version del propio Manufactoo Player (Electron), para mostrarla/loguearla. */
  playerVersion: string;
  /** p.ej. ["serial","mqtt","print.ipp","print.raw"]. */
  capabilities: string[];
  /**
   * Token de dispositivo del Player (nunca un JWT de usuario: dentro del Player
   * no hay nadie logueado). apiClient lo adjunta como X-Player-Token en cada
   * peticion cuando no hay sesion de usuario, para que el runtime funcione
   * exactamente igual dentro del Player que en un navegador con sesion.
   */
  playerToken: string | null;
  /** A que estacion esta emparejado este Player (null si aun no se ha emparejado). */
  getStationId(): Promise<number | null>;
  /** Se llama con cada dato en bruto que llega de un Device de entrada (p.ej. una trama de puerto serie). */
  onDeviceData(deviceId: number, callback: (raw: string) => void): () => void;
  /** Se llama con cada mensaje recibido en un Event (topic MQTT) de suscripcion. */
  onEventData(eventId: number, callback: (raw: string) => void): () => void;
  /** Envia datos a un Device de salida (impresora). */
  print(deviceId: number, payload: string): Promise<void>;
  /** Publica en un Event (topic MQTT) de salida. */
  publishEvent(eventId: number, payload: string): Promise<void>;
}

declare global {
  interface Window {
    manufactoo?: ManufactooBridge;
  }
}

export function getBridge(): ManufactooBridge | undefined {
  return typeof window !== "undefined" ? window.manufactoo : undefined;
}

export function hasCapability(capability: string): boolean {
  return getBridge()?.capabilities?.includes(capability) ?? false;
}
