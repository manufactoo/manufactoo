# Manufactoo Player

Aplicacion de escritorio (Electron) que abre en un PC de planta la estacion
que le corresponde, con acceso nativo a los dispositivos locales (puerto
serie, MQTT, impresoras) que un navegador normal no puede tocar.

La UI de la estacion **no vive aqui**: el Player carga la misma pagina web
que un navegador (`/dashboard/stations/:id/run`, servida por el propio MES).
Este proyecto solo aporta el "cascaron" nativo + el puente
`window.manufactoo` (ver `frontend/src/features/stations/manufactoo-bridge.ts`
en el proyecto principal, que es el contrato exacto que implementa
`src/preload/index.js`).

Ver `docs/estaciones-runtime-y-player.md` (en la raiz del repo) para la
arquitectura completa: emparejamiento, identidad de estacion, MQTT,
actualizaciones.

## Dos formas de ejecutarlo: desarrollo vs producción

| | **Desarrollo** (`npm run dev`) | **Producción** (instalador + `.env`) |
|---|---|---|
| Backend y frontend | Origenes **distintos**: Spring en `:8080`, Vite en `:5173` (docker-compose.dev.yml) | Mismo origen/dominio (reverse proxy delante de ambos) |
| Configuracion | Va cableada en el propio script `npm run dev`, no hace falta tocar nada | Fichero `.env` **junto al `.exe` instalado**, uno por PC/empresa |
| Ventana | Normal (no pantalla completa), para poder ver la consola | Pantalla completa (kiosco) |

Por que son distintos: en desarrollo, Spring Boot (el backend) NO sirve las
rutas `/dashboard/...` -- esas las sirve el servidor de Vite. En una
instalacion real, backend y frontend van detras del mismo dominio, asi que
el Player solo necesita UNA url.

### Desarrollo

```bash
npm install
npm run dev
```

Requiere `docker compose -f docker-compose.dev.yml up` arrancado. La primera
vez mostrara un codigo de emparejamiento: asignalo a una estacion desde
Manufactoo (**Estaciones > Players**).

### Producción (tras instalar en un PC de la empresa)

Copia `.env.example` a `.env` **en la misma carpeta donde se instalo el
Player** (p. ej. `C:\Users\<usuario>\AppData\Local\Programs\Manufactoo Player\.env`
en Windows) y pon la URL real del servidor Manufactoo de esa empresa:

```
MANUFACTOO_BACKEND_URL=https://manufactoo.miempresa.local
```

No hace falta `MANUFACTOO_FRONTEND_URL` (usa la misma URL por defecto). El
Player la lee automaticamente al arrancar -- no hay que reconstruir nada por
cliente/servidor distinto.

### Configuracion local del Player

La URL configurada, el estado del emparejamiento y el token de dispositivo
se guardan en `app.getPath('userData')` (p. ej. `%APPDATA%/manufactoo-player`
en Windows), con el token cifrado via `safeStorage` (usa el almacen de
credenciales del sistema operativo). Para "desemparejar" a mano, borra ese
fichero de configuracion o usa el boton "Desemparejar" del panel web (que no
borra el fichero local: si vuelves a arrancar el Player con el mismo
fichero, tendra un token que el backend ya no reconoce y se re-emparejara
solo, ver `pairing.js`).

La configuracion local (URL del backend, token de emparejamiento) se guarda
en `app.getPath('userData')` (p. ej. `%APPDATA%/manufactoo-player` en
Windows), con el token cifrado via `safeStorage` (usa el almacen de
credenciales del sistema operativo). Para "desemparejar" en desarrollo,
borra ese fichero de configuracion o usa el boton "Desemparejar" del panel
web (que no borra el fichero local, asi que si vuelves a arrancar el Player
con el mismo fichero, tendra un token que el backend ya no reconoce: bastara
con generar uno nuevo eliminando el fichero de config).

## Generar un instalador

```bash
npm run dist:win    # o dist:mac / dist:linux
```

El resultado (`dist/Manufactoo-Player-Setup-<version>.exe` en Windows) es lo
que un administrador sube desde **Estaciones > Players** (o el endpoint
`POST /api/player-releases`) para que el resto de Players de la empresa se
actualicen solos.

## Estructura

```
src/
  main/                 Proceso principal (Node): todo lo que necesita acceso al sistema.
    index.js             Orquestador: ventanas, emparejamiento, ciclo de vida.
    config.js            Config local persistente (token cifrado con safeStorage).
    api.js                Cliente HTTP contra el backend de Manufactoo.
    pairing.js            Flujo de emparejamiento (device code flow).
    updater.js            electron-updater contra el feed propio del backend.
    devices/
      registry.js          Traduce Transport -> conexion nativa real; reenvia datos por IPC.
      serial.js            SERIAL (puerto serie).
      mqtt.js               Cliente MQTT compartido (Events).
      print.js              IPP_CUPS / ZPL_RAW / ESC_POS.
  preload/index.js       contextBridge -> window.manufactoo (el runtime web lo consume).
  pairing-screen/        Pantalla minima mostrada antes de tener una estacion asignada.
```

## Por que esta arquitectura (resumen para quien retome esto)

- **El Player nunca empaqueta el frontend**: siempre carga la URL en vivo del
  backend. Un cambio de diseno de estacion, o incluso una nueva version del
  runtime React, llega a todas las estaciones sin re-publicar el Player.
- **`window.manufactoo` es aditivo**: anadir una capacidad nueva (p. ej. un
  transporte Modbus) es anadir un campo/metodo nuevo, nunca tocar uno
  existente. El runtime web comprueba `capabilities`, nunca asume una
  version exacta del Player instalado.
- **El Player reutiliza los endpoints publicos del MES** (`/api/stations`,
  `/api/devices`, `/api/events`...), autenticado con un token de dispositivo
  propio (`X-Player-Token`) en vez de un JWT de usuario. No hay una API
  paralela que mantener sincronizada.
- **USB_HID (emulacion de teclado) no pasa por aqui**: ya funciona en
  cualquier navegador sin Player, por eso `registry.js` no lo gestiona.
