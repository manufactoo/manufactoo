# Estaciones: runtime, Manufactoo Player (Electron), identidad, MQTT, triggers y rutas

Este documento describe cómo se **ejecutan** las estaciones diseñadas en el builder
no-code, cómo se distribuyen a los PCs de planta, cómo cada PC sabe qué estación es,
y el modelo de triggers y de rutas. Está inspirado en cómo lo resuelven Tulip
(tulip.co) y plataformas similares (Tulip Player + Tulip Tables + Connectors +
Machines), adaptado a la arquitectura on-premise de Manufactoo (Odoo como fuente de
verdad, broker MQTT embebido, sin nube).

> Estado: el **diseño** (builder), el **runtime web**, la **grabación de
> genealogía**, el **Manufactoo Player (Electron)**, el **emparejamiento de
> estación**, el **feed de actualización propio** y las **rutas por
> producto** (§9) están implementados y verificados. El I/O real de un
> dispositivo concreto (abrir SU puerto serie exacto, publicar en SU broker
> MQTT exacto) depende del hardware de cada planta y se prueba en campo; aquí
> se documenta el mecanismo genérico ya construido (ver `electron-player/` y
> §2-§4).

---

## 1. Dos modos de ejecución: navegador y Player

Una estación (secuencia de pantallas con widgets) es la **misma definición** en los
dos modos; lo único que cambia es el *host* que la ejecuta y a qué hardware puede
acceder. La regla de oro es **WYSIWYG**: lo que se diseña es exactamente lo que ve el
operario (ver §5).

| | **Modo navegador** | **Modo Player (Electron)** |
|---|---|---|
| Cómo se abre | `/{...}/stations/:id/run` en Chrome/Edge | App de escritorio Manufactoo Player |
| Hardware | Solo **emulación de teclado** (wedge USB‑HID): el lector escribe en el campo enfocado como si fuera un teclado | **Puerto serie / RS‑232 / USB / impresora / MQTT local**: acceso nativo |
| Cuándo usarlo | Estaciones simples (un lector wedge, selección en pantalla) | Estaciones con báscula serie, PLC, impresora ZPL, dispositivos que publican por MQTT |
| Actualización | Recargar el navegador | Auto‑update del Player (§3) |

**Consecuencia práctica:** una estación cuyos únicos "dispositivos" sean lectores de
código de barras en **emulación de teclado** funciona en el navegador sin Player. En
cuanto una estación necesita puerto serie/USB/MQTT real, se abre con el Player. El
diseño no cambia entre ambos.

Cómo lo decide Manufactoo: al abrir una estación se inspeccionan sus widgets. Si algún
campo referencia un `Device` con transporte `SERIAL`/`IPP_CUPS`/`ZPL_RAW`/… o un
`Event` (topic MQTT), el runtime marca la estación como **"requiere Player"** y, en el
navegador, muestra un aviso con enlace para abrirla en el Player. Los widgets con
dispositivo `USB_HID` (wedge) o sin dispositivo funcionan en ambos.

---

## 2. Qué es el Manufactoo Player (implementado en `electron-player/`)

El **Player** es una aplicación de escritorio (Electron) que:

1. Arranca a pantalla completa (modo kiosco; `MANUFACTOO_PLAYER_WINDOWED=1` para
   desarrollo) en el PC de la estación — `src/main/index.js`.
2. Se autentica contra el backend de Manufactoo con un **token de dispositivo**
   (`X-Player-Token`), nunca con credenciales de persona — `PlayerAuthFilter.java`
   en el backend, `src/main/api.js` en el Player.
3. Sabe **qué estación** representa (§4) y carga su runtime: cuando abre la
   estación, `openStationWindow()` navega literalmente a
   `<backendUrl>/dashboard/stations/:id/run` — la MISMA página que un navegador
   normal, nunca una copia empaquetada.
4. Expone al runtime una API local (`window.manufactoo`, ver
   `frontend/src/features/stations/manufactoo-bridge.ts` para el contrato
   exacto) para el hardware que el navegador no puede tocar:
   - **Serie/RS‑232**: `serialport` (Node) — `src/main/devices/serial.js`, mapea
     uno a uno los campos de conexión de `DeviceCatalog.java` (puerto, baudios,
     bits, paridad, control de flujo, fin de línea, codificación).
   - **Impresión** ZPL/ESC‑POS (socket TCP crudo) e IPP/CUPS —
     `src/main/devices/print.js`.
   - **MQTT**: un único cliente compartido que se suscribe a los `Event` de
     entrada y publica en los de salida — `src/main/devices/mqtt.js`.
5. Enruta esos datos al widget correspondiente (el campo cuya `sourceDeviceId` /
   `sourceEventId` coincide) — ver §6; verificado con un bridge simulado en el
   runtime web.

Arquitectura de procesos (patrón estándar y seguro de Electron):

```
┌─────────────────────────────────────────────┐
│ Electron main process (Node)                 │
│  · serialport (RS-232)      devices/serial.js│
│  · mqtt client               devices/mqtt.js │
│  · impresión raw/IPP         devices/print.js│
│  · auto-update (electron-updater) updater.js │
│  · emparejamiento             pairing.js     │
│  · config local cifrada       config.js      │
└───────────────▲───────────────┬──────────────┘
        IPC vía  │ contextBridge │  (src/preload/index.js,
     window.manufactoo           │   contextIsolation:true, nodeIntegration:false)
┌───────────────┴───────────────▼──────────────┐
│ Renderer = runtime web de la estación         │
│  (la MISMA app React que /stations/:id/run,   │
│   cargada por URL, nunca empaquetada)         │
└───────────────────────────────────────────────┘
```

Seguridad: `contextIsolation: true`, `nodeIntegration: false`, y un `preload.js` que
expone **solo** las funciones necesarias por `contextBridge`. El renderer nunca tiene
acceso directo a Node. El runtime web autentica sus propias llamadas API con el mismo
token de dispositivo, expuesto como `window.manufactoo.playerToken` y adjuntado
automáticamente por `apiClient` (`frontend/src/lib/api-client.ts`) cuando no hay un
usuario logueado — así el runtime funciona exactamente igual dentro del Player que en
un navegador con sesión.

---

## 3. Instalación en la empresa y actualizaciones automáticas

Objetivo industrial: **cero mantenimiento manual** en decenas de PCs de planta, y
funcionamiento en redes **sin internet** (muchas plantas están aisladas).

### Instalación
- Instaladores generados con **electron-builder** (`npm run dist:win/mac/linux` en
  `electron-player/`): `.exe` (NSIS) para Windows —el SO habitual en planta—, `.dmg`
  para macOS, `.AppImage` para Linux.
- Se instala una vez por PC. En el primer arranque se **empareja** con una estación
  (§4). A partir de ahí arranca solo (auto‑login del SO + Player en modo kiosco).

### Actualizaciones automáticas (on-premise, sin nube) — implementado
- **electron-updater** (`src/main/updater.js`) apunta a un *feed* alojado por el propio
  backend de Manufactoo (`com.manufactoo.players.release`), nunca por GitHub/nube:
  ```
  GET /api/player-releases/latest.yml        (Windows; latest-mac.yml / latest-linux.yml para el resto)
  GET /api/player-releases/{id}/download
  ```
  El manifiesto YAML se genera al vuelo con el hash SHA‑512 del instalador (verificado
  end-to-end: el hash declarado coincide exactamente con el fichero servido), así que
  electron-updater puede comprobar integridad sin salir de la LAN de la empresa.
- Flujo real: un admin sube el instalador desde **Estaciones > Players** (o
  `POST /api/player-releases`, multipart, requiere sesión) → los Players lo detectan en
  su siguiente comprobación horaria → descargan en segundo plano
  (`autoDownload: true`) → **se instala al cerrar la app** (`autoInstallOnAppQuit`),
  nunca a media faena.
- Diferenciar **runtime** de **shell**: la UI del runtime (React) se sirve del backend,
  así que un cambio de diseño/lógica de estación es inmediato (sin actualizar el
  Player: `openStationWindow()` siempre carga la URL en vivo). El auto‑update del
  Player solo hace falta cuando cambia el *shell* nativo (versión de Electron, un
  transporte de dispositivo nuevo). Esto minimiza las actualizaciones nativas.

> Comparación Tulip: Tulip Player se instala por dispositivo y se actualiza solo; las
> apps (diseño) viven en el servidor y se publican sin reinstalar nada. Aquí igual,
> pero con el feed de updates alojado on‑prem, en el propio servidor de la empresa.

---

## 4. Identidad de estación: ¿cómo sabe un PC qué estación es?

Es la pregunta clave en planta. La **solución industrial** (la que usan Tulip con
"Stations/Player" y la mayoría de MES) es **emparejamiento por dispositivo**, no meter
la URL a mano en cada PC — implementado como un flujo tipo *device code* (el mismo que
usan las smart TVs para emparejarse con una cuenta):

1. La tabla **`station_players`** (`V13__station_players.sql`) guarda un "puesto
   físico" por PC: `id`, `name`, `hostname`, `station_id` (a qué estación apunta hoy,
   `null` mientras no se asigne), `pairing_id`/`pairing_code`/`pairing_expires_at`
   (mientras está pendiente), `device_token_hash` (nunca el token en claro),
   `player_version`, `last_seen_at`.
2. En el primer arranque, `POST /api/players/register` (público) crea el registro y
   devuelve un `pairingId` (secreto, solo lo tiene el Player) + un `pairingCode` de 6
   caracteres legibles (para que un humano compare visualmente qué Player es cuál en
   la lista de pendientes). El Player lo muestra en pantalla completa y sondea
   `GET /api/players/register/{pairingId}` cada 3s.
3. Un administrador, desde **Estaciones > Players** (JWT normal, sin rol especial —
   hoy solo existe el rol ADMIN), ve el Player pendiente con su código y lo **asigna a
   una estación** (`PUT /api/players/{id}`).
4. En su siguiente sondeo, el Player recibe `{status:"PAIRED", token, stationId}` — el
   token de dispositivo se entrega **una única vez** (`PlayerService.pollPairing`
   limpia el `pairingId` al entregarlo); si se pierde esa respuesta, hay que
   desemparejar y volver a empezar, igual que en OAuth device-code. El Player lo guarda
   cifrado con `safeStorage` (usa el almacén de credenciales del propio SO: DPAPI en
   Windows, Keychain en macOS, libsecret en Linux).
5. A partir de ahí, ese PC **siempre** abre esa estación al arrancar
   (`GET /api/players/me`, autenticado con `X-Player-Token`), sin intervención.
   Reasignar una estación a otro puesto se hace desde el panel, no tocando el PC.

Verificado de extremo a extremo contra el backend real: registro → sondeo pendiente →
asignación admin → entrega del token (una sola vez; un segundo sondeo con el mismo
`pairingId` da `NOT_FOUND`) → `/me` devuelve la estación correcta → `heartbeat` deja
ver en el panel la versión del Player y la última conexión.

Ventajas frente a alternativas:
- **Mejor que "URL/param por PC"** (frágil, se pierde al reinstalar, cualquiera la
  cambia).
- **Mejor que "por hostname/MAC"** (rompe al cambiar de PC o tarjeta de red), aunque
  el hostname se guarda como *información* útil para identificar el Player en la lista.
- El binding vive en el **servidor**, así que sobrevive a reinstalaciones del PC: si se
  reinstala, se vuelve a emparejar y un admin lo reasigna a la misma estación.

Un mismo `station_id` puede tener **varios** `station_players` (varios PCs con la
misma estación) — normal en líneas paralelas. Además, el **encabezado del runtime**
siempre muestra de forma visible **qué estación** es (para que el operario nunca dude),
como ya hace Tulip.

---

## 5. Fidelidad de diseño (WYSIWYG) y adaptación al dispositivo

Problema que se corrige: en el primer prototipo el modo producción **no se veía igual**
que el diseño (las filas del grid se estiraban). Solución implementada:

- El editor y el runtime comparten **exactamente la misma geometría de grid**
  (`gridContainerStyle()` en `frontend/src/features/stations/gridGeometry.ts`): 12
  columnas `1fr`, filas fijas de 56 px, mismo *gap* y *padding*. La única diferencia es
  que en producción no hay *handles* de arrastre.
- **Adaptación al dispositivo**: las 12 columnas son fraccionales (`1fr`), así que el
  layout **escala horizontalmente** con el ancho de la pantalla que abra la estación
  (una tablet, un monitor 24"…), manteniendo las proporciones del diseño. Las filas son
  de alto fijo para que la distribución vertical sea idéntica.
- Enfoque equivalente al de Tulip: se diseña sobre un lienzo con posiciones y la app se
  ajusta al display del Player manteniendo la composición.

> Futuro opcional: un modo "lienzo de tamaño fijo que se escala completo" (como el
> `viewport` fijo de Tulip) si se quiere fidelidad pixel‑perfect en verticales; hoy el
> grid `1fr` + filas fijas ya da la misma distribución en cualquier ancho.

---

## 6. Dispositivos y eventos MQTT alimentando campos

El diseño ya permite asociar a un **campo de datos**:
- un **dispositivo de entrada** (`sourceDeviceId`) — p. ej. un lector de código de
  barras que rellena el campo "operario"; o
- un **evento MQTT de entrada** (`sourceEventId`) — un topic de *suscripción* definido
  en la app **Eventos**; la estación "espera" ese topic y su valor rellena el campo.

En el runtime web esto se muestra como un **badge** en el campo (dispositivo o topic).
En el **Player**, el `window.manufactoo` del §2 hace que llegue el dato real:

- **Serie/USB**: el Player abre el puerto del `Device` y, al recibir una trama, la
  escribe en el campo cuyo `sourceDeviceId` coincide (equivalente a un "device
  trigger" de Tulip: *cuando el dispositivo X emite → guarda en el campo Y*).
- **MQTT**: el Player (o el servidor) se suscribe al topic del `Event`; al llegar un
  mensaje, rellena el campo cuyo `sourceEventId` coincide. Los eventos de **salida**
  (`PUBLISH`) se disparan desde triggers (§7), p. ej. al finalizar una pantalla se
  publica el resultado a un topic para un PLC.

Un mismo campo también se puede rellenar a mano (fallback), de modo que la estación no
se bloquea si el hardware falla.

### Código leído vs. valor mostrado vs. valor guardado (ya implementado)

Un caso muy real: un desplegable de **Operario** (origen `ODOO_OPERATORS`) tiene un
dispositivo RS232/USB asociado (un lector de códigos), pero lo que ese lector lee es
el **código de la credencial del operario** (p. ej. `0001`), no su nombre ni el id
interno de Odoo. Tres cosas distintas que había que separar con claridad:

1. **Código leído**: lo que llega en bruto del dispositivo/evento (`0001`).
2. **Valor mostrado**: el operario tiene que ver el **nombre** (`Alejandro Rioja`), no
   el código, para confirmar visualmente que ha fichado quien tocaba.
3. **Valor guardado en trazabilidad**: el **id del registro Odoo** (`2`), igual que si
   se hubiera elegido a mano en el desplegable — nunca el código en bruto ni el nombre
   (el nombre puede cambiar; el id es estable y es lo que ya usa el resto del sistema).

Solución implementada (no requiere Player: funciona ya en el navegador, porque un
lector en emulación de teclado simplemente escribe en el campo con foco):

- **Columna de coincidencia** (`config.lookupColumn` en el widget DROPDOWN): el
  diseñador elige por qué columna de Odoo se busca el código (p. ej. `barcode` para
  operarios/productos — Odoo ya tiene un campo `barcode` en `hr.employee` pensado
  exactamente para esto, badges de fichaje/kiosko). Solo aparece cuando el desplegable
  tiene un origen Odoo *y* un dispositivo/evento asociado.
- **`GET /api/stations/data-source-lookup?type=...&column=...&code=...`**: busca en
  vivo (reutilizando `MasterDataService`) el registro cuyo campo coincide con el
  código (comparación tolerante a mayúsculas/espacios, por el ruido que a veces añaden
  los lectores), y devuelve `{value: id, label: nombre}` o 404 si no hay coincidencia.
- **Runtime**: el desplegable con dispositivo/evento + columna de coincidencia muestra
  un pequeño campo de escaneo (icono de escáner) debajo. Al pulsar Enter, resuelve el
  código: si lo encuentra, fija el desplegable al id resuelto (mismo `onChange` que
  una selección manual) y cachea la opción para que se muestre el nombre; si no,
  avisa "no se ha encontrado ningún registro con ese código", sin tocar el valor
  actual. El operario también puede seguir eligiendo a mano si el escaneo falla.

Verificado de extremo a extremo contra Odoo real: escanear `0001` resuelve a
"Alejandro Rioja" en pantalla, y el registro de genealogía guarda `{"operario": "2"}`.

### Texto validado a mano contra Odoo (ya implementado)

El caso anterior asume un lector (dispositivo/evento). Pero muchas estaciones no
tienen lector: el operario teclea el código de operario, serie o referencia
directamente en un campo **Texto** (`TEXT_INPUT`). Ese código también debe ser
válido en Odoo — sin necesitar un dispositivo asociado.

A diferencia de DROPDOWN/TABLE, en `TEXT_INPUT` el origen de datos es
**opcional**: sin él, sigue siendo un texto libre normal (compatible con todas
las estaciones ya diseñadas). Si el diseñador elige un origen Odoo y una
columna de coincidencia (mismo selector que en DROPDOWN, aquí sin exigir un
dispositivo/evento):

- **Qué dato se teclea**: la "columna de coincidencia" (p. ej. `barcode` para
  operarios/productos). Solo se ofrecen las columnas que tienen sentido como
  código (mismo `LOOKUP_COLUMNS` que ya usaba DROPDOWN).
- **Runtime**: cada vez que cambia el valor tecleado (con un pequeño debounce),
  se resuelve contra `data-source-lookup-row` (todas las columnas del registro,
  no solo una) y, si no hay coincidencia, se avisa "código no válido en Odoo"
  justo debajo del campo. A diferencia de DROPDOWN, aquí el valor guardado
  **es el código tecleado**, no un id resuelto. El propio `TEXT_INPUT` ya NO
  enseña ningún dato del registro encontrado (nombre, departamento...) — ver
  "Widgets mínimos y Etiquetas vinculadas" más abajo para eso.
- **Backend**: `StationService.validateDataSourceLookups()` revalida el
  código de coincidencia al enviar el registro (nunca confía solo en la
  validación del cliente), reutilizando el mismo `DataSourceResolver.lookup()`
  que ya usa DROPDOWN. Si Odoo no responde, el envío falla (502) en vez de
  aceptar un código sin validar.

### Widgets mínimos y Etiquetas vinculadas (ya implementado)

Cada widget de datos (`DROPDOWN`, `TEXT_INPUT`, `NUMBER_INPUT`) se reduce a su
expresión mínima: **solo el control**, sin ninguna etiqueta ni dato de detalle
incrustado. Si el diseñador quiere un título encima o un dato resuelto de Odoo
debajo, añade un widget **Etiqueta** (`LABEL`) suelto y lo coloca donde quiera
— la misma libertad de layout que ya tenía cualquier otro widget. Esto sustituye
al antiguo `config.detailColumns` (una lista de columnas fija dentro del propio
`TEXT_INPUT`): ahora cualquier Etiqueta, en cualquier sitio de la estación,
puede mostrar cualquier dato de cualquier widget que capture datos.

Una Etiqueta tiene dos modos, elegidos en Propiedades:

- **Texto fijo** (el de siempre): se teclea directamente encima del propio
  widget en el lienzo.
- **Vinculada a otro widget** (`config.boundTo` = el `bindingKey` del widget
  origen, `config.boundField` = qué dato suyo mostrar): en vez de un texto fijo,
  se calcula en vivo. `boundField` puede ser `_value` (el valor crudo
  introducido/seleccionado, vale para cualquier widget) o, si el origen trae
  datos de Odoo, una de sus columnas resueltas:
  - **`TEXT_INPUT` validado**: cualquier columna del registro encontrado por
    el código tecleado (antes limitado a las que el propio campo eligiera).
  - **`DROPDOWN`**: cualquier columna del registro seleccionado (no solo la
    etiqueta ya visible en el desplegable).
  - **`TABLE` con selección única**: cualquier columna de la fila marcada.

En el editor, una Etiqueta vinculada muestra un valor de ejemplo (mismo sitio,
mismo tamaño) porque en diseño no hay ningún dato real todavía — el mismo
principio WYSIWYG que ya usaba el resto de widgets. En el runtime,
`StationRuntimePage` calcula un mapa `resolvedRows` (por `bindingKey` → sus
datos disponibles) a partir de: el valor crudo de cada campo, las tablas
completas de cada `DROPDOWN`/`TABLE` (`GET /api/stations/data-source-table`,
cacheada por tipo en `dataSourceTableCache.ts` para no duplicar peticiones con
el propio widget TABLE), y la fila que cada `TEXT_INPUT` validado reporta al
resolver un código (`onResolvedRow`). Cada `WidgetView` de tipo `LABEL`
simplemente lee de ese mapa — no resuelve nada por su cuenta.

Backend: `WidgetCatalog` ya no exige texto en una Etiqueta (`text` es
opcional); `StationService.validate()` exige que tenga texto fijo **o**
`boundTo`, y que `boundTo` apunte a un `bindingKey` que exista de verdad en la
estación (evita vinculaciones colgadas tras borrar/renombrar el widget origen).

> **Nota de migración**: las estaciones creadas antes de este cambio que
> tenían un `TEXT_INPUT`/`DROPDOWN`/`NUMBER_INPUT` con etiqueta visible dejan
> de mostrarla (el campo `label` del widget sigue existiendo — se usa en
> mensajes de validación y en el selector "Vincular a" — pero ya no se pinta
> encima del control). Hay que añadir un widget Etiqueta manualmente donde se
> quiera recuperar ese título.

---

## 7. Botones y triggers (modelo Tulip)

Hoy un **Botón** tiene una **acción** configurable: `NEXT` / `PREV` / `GOTO` (ir a una
pantalla) / `SUBMIT` (finalizar y registrar). Esto ya cubre la navegación de la
secuencia y el cierre del registro de genealogía.

El modelo objetivo, como en Tulip, es un **trigger** = *evento → (condiciones) →
acciones*, reutilizable en botones, al entrar/salir de una pantalla, o al recibir un
dato de dispositivo/evento:

- **Eventos**: pulsar un botón; abrir/cerrar una pantalla; recibir de un dispositivo;
  recibir un topic MQTT; temporizador.
- **Condiciones**: comparaciones sobre los valores capturados (p. ej. `peso > 10`).
- **Acciones**: ir a pantalla / finalizar y registrar; **escribir en una impresora**
  (ZPL/ESC‑POS); **publicar un topic MQTT**; encender una baliza; guardar/derivar un
  valor; validar; mostrar mensaje.

Se guardaría como una lista de triggers en `config` del widget (o de la pantalla), y el
runtime los evalúa. La base ya existe (acciones de navegación + validación de
obligatorios + grabación transaccional); ampliarlo a impresión/MQTT/condiciones es el
siguiente paso natural del runtime.

---

## 8. Tablas: mostrar vs seleccionar

Una **Tabla** enlaza a un origen de datos (Odoo productos/órdenes/operarios/BOM) y
tiene un modo de selección configurable:
- `NONE` — solo muestra (consulta en vivo desde Odoo).
- `SINGLE` — el operario **selecciona una** fila; se guarda el valor de la columna
  configurada (`valueColumn`, por defecto `id`) en la clave de datos del widget.
- `MULTI` — selección múltiple; se guarda un array de valores.

Así, "enlaza la tabla con órdenes" muestra todas las órdenes y, si es seleccionable,
lo que elija el operario entra en la **genealogía** (verificado: seleccionar la orden
`WH/MO/00001` guarda `{ "orden_sel": "1" }`). Es el equivalente al *Table Records
widget* de Tulip con selección que alimenta una variable.

---

## 9. Rutas por modelo — implementado

Investigado cómo lo hacen otros MES y Odoo antes de implementarlo: el patrón general
(SGSystems, Tulip, QAD/Infor) es un *process routing* que define la secuencia de
operaciones/estaciones por producto, con "step readiness / preconditions" que bloquean
avanzar si el paso anterior no está confirmado — exactamente lo que se pedía. Odoo ya
tiene el mismo concepto (`mrp.bom` con operaciones y `mrp.workcenter` en la pestaña
"Operaciones"), definido **por producto/BOM**, no por unidad.

### Modelo de datos (`com.manufactoo.routes`, migración V15)

- **`manufacturing_routes`**: `name`, `description`, `productId`/`productName` (id y
  nombre de un producto Odoo — cacheado, de solo lectura; `null` = la ruta aplica
  independientemente del producto), **`identifierBindingKey`**, `enabled`.
- **`route_steps`**: `route_id`, `station_id`, `order_index`, `name`. Aggregate root
  igual que `Station`→`StationScreen`: el editor envía la ruta completa y el backend
  reconcilia (`RouteService.applyRequest`), sustituyendo los pasos en bloque (no tienen
  referencias externas, a diferencia de los widgets de una pantalla).

### La pieza clave: `identifierBindingKey`

Es la respuesta a "¿cómo sabe el sistema qué unidad es cuál a lo largo de la ruta?".
Una ruta declara **qué clave de datos identifica la unidad** en cada una de sus
estaciones — puede ser literalmente cualquier cosa que el diseñador de la estación ya
capture: el **serial/lote de Odoo** (`ODOO_SERIALS`, ver más abajo), una **orden de
fabricación**, un **producto**, o cualquier clave de un campo de texto/dropdown. No
hay un tipo de "identificador" especial a nivel de dato: cada estación de la ruta
simplemente necesita un widget cuyo `bindingKey` coincida con esa misma clave (p. ej.
`"serial"`).

### Enforcement (`StationService.validateRouteSequence`)

Al enviar un registro de estación (`submitRecord`):
1. Busca las rutas **habilitadas** que incluyen esta estación como paso
   (`RouteService.findEnabledRoutesForStation`).
2. Si el envío no trae el `identifierBindingKey` de una ruta dada, esa ruta **no
   aplica** a este envío (permite que una misma estación sirva a varios
   productos/rutas sin bloquearse mutuamente).
3. Si lo trae, comprueba que **todos los pasos anteriores** de esa ruta ya tienen un
   `station_trace_record` con ese mismo valor de identificador. Si falta alguno,
   rechaza con un mensaje claro indicando qué estación y qué paso falta — nunca deja
   avanzar una unidad que se ha saltado un paso.

Verificado de extremo a extremo contra el backend real con una ruta de 2 pasos
(Pick&Place → Estación 2, `identifierBindingKey="serial"`, usando series reales de
Odoo `stock.lot`):
- Enviar el paso 2 sin haber pasado por el paso 1 → **rechazado** ("no ha pasado
  todavia por la estacion 'Montaje'...").
- Completar el paso 1 para el serial `0000001` → aceptado; repetir el paso 2 para el
  **mismo** serial → ahora aceptado.
- Probar el paso 2 con un serial **distinto** que nunca pasó por el paso 1 → rechazado
  de nuevo (el control es por unidad individual, no global).
- Deshabilitar la ruta → el mismo envío que antes se rechazaba pasa a aceptarse
  (el enforcement solo actúa sobre rutas `enabled`).

### Series/lotes de Odoo como dato maestro (`ODOO_SERIALS`)

Petición explícita: los números de serie/lote que genera Odoo (`stock.lot`) debían
poder usarse igual que productos/operarios/órdenes. Añadido como:
- Un dato maestro más en **Datos maestros > Series** (`GET /api/master-data/serials`).
- Un origen de datos más para desplegables/tablas de estación (`ODOO_SERIALS`), con
  columna de búsqueda `name` (el propio número de serie) para poder escanearlo con el
  mismo mecanismo de "código leído → registro resuelto" del §6.

### UI (`Estaciones > Rutas`)

Nueva pestaña junto a Estaciones y Players: crea/edita una ruta (nombre, producto vía
selector de Datos maestros, clave identificadora, activa/inactiva) y su secuencia de
pasos (añadir/quitar/reordenar estaciones existentes). Verificado con datos reales:
crear, editar (incluye reconciliación correcta de los pasos) y listar funcionan contra
el backend real.

### Decisión tomada: ¿Odoo o Manufactoo define la ruta?

Se optó por **definirla en Manufactoo** (más flexible para el MES, no depende de tener
el módulo de rutings de Odoo activado) y solo **referenciar** el producto de Odoo de
forma informativa (`productId`/`productName`). El "as-built" (lo que realmente ocurrió
unidad a unidad) sigue viviendo en `station_trace_records`, que ya es la fuente de
verdad de la genealogía.

---

## Referencias de implementación (código actual)

- Modelo de datos y builder: `backend/src/main/java/com/manufactoo/stations/*`,
  `frontend/src/features/stations/*`.
- Geometría WYSIWYG compartida: `frontend/src/features/stations/gridGeometry.ts`.
- Asociación dispositivo/evento a campo: columnas `source_device_id` /
  `source_event_id` en `screen_widgets` (migraciones V11/V12).
- Resolución código→registro (barcode escaneado → id Odoo mostrado por nombre):
  `backend/src/main/java/com/manufactoo/stations/DataSourceResolver.java` (método
  `lookup`), `GET /api/stations/data-source-lookup`, `WidgetView.tsx` (`ScanResolver`).
- Genealogía: `station_trace_records` (un registro inmutable por ejecución de la
  secuencia) y `GET /api/stations/{id}/records`.
- **Emparejamiento y Players**: `backend/src/main/java/com/manufactoo/players/*`
  (`station_players`, migración V13), `PlayerAuthFilter` (auth por
  `X-Player-Token`), `frontend/src/features/stations/PlayersTab.tsx`.
- **Feed de actualización del Player**:
  `backend/src/main/java/com/manufactoo/players/release/*` (`player_releases`,
  migración V14), `GET /api/player-releases/latest*.yml`.
- **Contrato `window.manufactoo`**:
  `frontend/src/features/stations/manufactoo-bridge.ts` (lado web) y
  `electron-player/src/preload/index.js` (lado Player) — deben mantenerse en
  sincronía; es aditivo por diseño (ver comentarios en ambos ficheros).
- **Manufactoo Player (Electron)**: proyecto completo en `electron-player/` (ver su
  propio `README.md` para desarrollo y generación de instaladores).
- **Rutas**: `backend/src/main/java/com/manufactoo/routes/*` (`manufacturing_routes` /
  `route_steps`, migración V15), enforcement en
  `StationService.validateRouteSequence`, UI en
  `frontend/src/features/stations/RoutesTab.tsx`.
- **Series/lotes de Odoo como dato maestro**: `OdooMasterDataEntity.SERIAL`
  (`stock.lot`), `GET /api/master-data/serials`, `DataSourceType.ODOO_SERIALS`.
