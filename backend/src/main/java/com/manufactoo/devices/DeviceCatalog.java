package com.manufactoo.devices;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Fuente unica de verdad del modelo de dispositivos: que direcciones admite
 * cada categoria, que transportes son validos por categoria, y que campos
 * de conexion/configuracion corresponden a cada categoria+transporte.
 * DeviceService valida contra esto mismo, asi que backend y frontend nunca
 * pueden divergir (el frontend solo pide GET /api/devices/catalog).
 *
 * Los campos de conexion dependen del PAR (categoria, transporte), no solo
 * del transporte: por ejemplo un lector de codigo de barras por serie no
 * necesita seleccionar codificacion (siempre son digitos/ASCII simples),
 * mientras que una entrada RS232 generica si, porque puede recibir
 * cualquier dato de cualquier maquina.
 */
public final class DeviceCatalog {

    private DeviceCatalog() {
    }

    private static final Map<DeviceCategory, List<DeviceDirection>> ALLOWED_DIRECTIONS = new EnumMap<>(DeviceCategory.class);
    private static final Map<DeviceCategory, DeviceDirection> DEFAULT_DIRECTION = new EnumMap<>(DeviceCategory.class);
    private static final Map<DeviceCategory, List<Transport>> ALLOWED_TRANSPORTS = new EnumMap<>(DeviceCategory.class);
    private static final Map<DeviceCategory, List<DeviceFieldDef>> SETTINGS_FIELDS = new EnumMap<>(DeviceCategory.class);

    /** Campos de conexion por defecto de cada transporte. */
    private static final Map<Transport, List<DeviceFieldDef>> CONNECTION_FIELDS = new EnumMap<>(Transport.class);

    /** Cuando una categoria necesita un subconjunto distinto del transporte, se sobreescribe aqui. */
    private static final Map<DeviceCategory, Map<Transport, List<DeviceFieldDef>>> CONNECTION_FIELD_OVERRIDES = new EnumMap<>(DeviceCategory.class);

    private static final List<DeviceFieldDef> SERIAL_FIELDS_FULL = List.of(
            DeviceFieldDef.text("port", true, "COM3"),
            DeviceFieldDef.number("baudRate", true, "9600"),
            DeviceFieldDef.select("dataBits", true, List.of("5", "6", "7", "8")),
            DeviceFieldDef.select("stopBits", true, List.of("1", "1.5", "2")),
            DeviceFieldDef.select("parity", true, List.of("NONE", "EVEN", "ODD", "MARK", "SPACE")),
            DeviceFieldDef.select("flowControl", true, List.of("NONE", "RTS_CTS", "XON_XOFF")),
            DeviceFieldDef.select("lineEnding", true, List.of("NONE", "CR", "LF", "CRLF")),
            DeviceFieldDef.select("encoding", true, List.of("UTF8", "ASCII", "LATIN1")),
            DeviceFieldDef.number("timeoutMs", false, "3000")
    );

    /** Igual que SERIAL_FIELDS_FULL pero sin "encoding": un scanner de barras siempre emite ASCII simple. */
    private static final List<DeviceFieldDef> SERIAL_FIELDS_BARCODE = List.of(
            DeviceFieldDef.text("port", true, "COM3"),
            DeviceFieldDef.number("baudRate", true, "9600"),
            DeviceFieldDef.select("dataBits", true, List.of("5", "6", "7", "8")),
            DeviceFieldDef.select("stopBits", true, List.of("1", "1.5", "2")),
            DeviceFieldDef.select("parity", true, List.of("NONE", "EVEN", "ODD", "MARK", "SPACE")),
            DeviceFieldDef.select("flowControl", true, List.of("NONE", "RTS_CTS", "XON_XOFF")),
            DeviceFieldDef.select("lineEnding", true, List.of("NONE", "CR", "LF", "CRLF")),
            DeviceFieldDef.number("timeoutMs", false, "3000")
    );

    static {
        // --- BARCODE_SCANNER: solo entrada ---
        ALLOWED_DIRECTIONS.put(DeviceCategory.BARCODE_SCANNER, List.of(DeviceDirection.INPUT));
        DEFAULT_DIRECTION.put(DeviceCategory.BARCODE_SCANNER, DeviceDirection.INPUT);
        ALLOWED_TRANSPORTS.put(DeviceCategory.BARCODE_SCANNER, List.of(Transport.SERIAL, Transport.USB_HID));
        CONNECTION_FIELD_OVERRIDES.put(DeviceCategory.BARCODE_SCANNER, Map.of(
                Transport.SERIAL, SERIAL_FIELDS_BARCODE,
                // Emulacion de teclado (HID): el sistema operativo lo trata como un teclado
                // normal, no hace falta identificar vendor/product para leer sus pulsaciones.
                Transport.USB_HID, List.of()
        ));

        // --- RS232: entrada generica, cualquier maquina que pueda enviar un dato por serie ---
        ALLOWED_DIRECTIONS.put(DeviceCategory.RS232, List.of(DeviceDirection.INPUT));
        DEFAULT_DIRECTION.put(DeviceCategory.RS232, DeviceDirection.INPUT);
        ALLOWED_TRANSPORTS.put(DeviceCategory.RS232, List.of(Transport.SERIAL));

        // --- PRINTER: solo salida ---
        ALLOWED_DIRECTIONS.put(DeviceCategory.PRINTER, List.of(DeviceDirection.OUTPUT));
        DEFAULT_DIRECTION.put(DeviceCategory.PRINTER, DeviceDirection.OUTPUT);
        ALLOWED_TRANSPORTS.put(DeviceCategory.PRINTER, List.of(Transport.IPP_CUPS, Transport.ZPL_RAW, Transport.ESC_POS));

        // --- Campos de conexion por defecto, por transporte ---
        CONNECTION_FIELDS.put(Transport.SERIAL, SERIAL_FIELDS_FULL);
        CONNECTION_FIELDS.put(Transport.USB_HID, List.of(
                DeviceFieldDef.text("vendorId", false, "0x0483"),
                DeviceFieldDef.text("productId", false, "0x5750")));
        CONNECTION_FIELDS.put(Transport.IPP_CUPS, List.of(
                DeviceFieldDef.text("host", true, "192.168.1.100"),
                DeviceFieldDef.text("queue", true, "etiquetas-linea1")));
        CONNECTION_FIELDS.put(Transport.ZPL_RAW, List.of(
                DeviceFieldDef.text("host", true, "192.168.1.101"),
                DeviceFieldDef.number("tcpPort", true, "9100")));
        CONNECTION_FIELDS.put(Transport.ESC_POS, List.of(
                DeviceFieldDef.text("host", true, "192.168.1.102"),
                DeviceFieldDef.number("tcpPort", true, "9100")));

        // Ninguna categoria tiene settings propios de momento (se quito "symbologies" de BARCODE_SCANNER).
    }

    public static List<DeviceCategory> categoriesFor(DeviceDirection direction) {
        return ALLOWED_DIRECTIONS.entrySet().stream()
                .filter(e -> e.getValue().contains(direction))
                .map(Map.Entry::getKey)
                .toList();
    }

    public static List<DeviceDirection> directionsFor(DeviceCategory category) {
        return ALLOWED_DIRECTIONS.getOrDefault(category, List.of());
    }

    public static DeviceDirection defaultDirectionFor(DeviceCategory category) {
        return DEFAULT_DIRECTION.get(category);
    }

    public static List<Transport> transportsFor(DeviceCategory category) {
        return ALLOWED_TRANSPORTS.getOrDefault(category, List.of());
    }

    public static List<DeviceFieldDef> connectionFieldsFor(DeviceCategory category, Transport transport) {
        Map<Transport, List<DeviceFieldDef>> overrides = CONNECTION_FIELD_OVERRIDES.get(category);
        if (overrides != null && overrides.containsKey(transport)) {
            return overrides.get(transport);
        }
        return CONNECTION_FIELDS.getOrDefault(transport, List.of());
    }

    public static List<DeviceFieldDef> settingsFieldsFor(DeviceCategory category) {
        return SETTINGS_FIELDS.getOrDefault(category, List.of());
    }

    public static DeviceCategory[] allCategories() {
        return DeviceCategory.values();
    }
}
