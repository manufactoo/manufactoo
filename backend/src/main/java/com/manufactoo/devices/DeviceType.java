package com.manufactoo.devices;

/** Catalogo inicial de tipos de dispositivo. Ampliable: añadir un valor aqui
 * y sus claves requeridas en DeviceService.REQUIRED_CONFIG_KEYS. */
public enum DeviceType {
    SERIAL_READER,
    PRINTER,
    PICK_AND_PLACE,
    OTHER
}
