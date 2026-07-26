# manufactoo

**manufactoo** is an **Open-Source, No-Code Manufacturing Execution System (MES)**.

Enterprise-Grade Capabilities with Secure, Cost-Effective On-Premises Deployment.

- **Website:** [manufactoo.com](https://manufactoo.com)
- **License:** GNU Lesser General Public License v3 (LGPL-3.0)

## Manufactoo Player (shop-floor desktop app)

Stations designed in Manufactoo (see `docs/estaciones-runtime-y-player.md`) run
in two ways:

- **In a plain browser** — works out of the box for keyboard-emulation
  devices (USB-HID barcode scanners): they type into whatever field has
  focus, no extra software needed.
- **In the Manufactoo Player** (`electron-player/`) — a small desktop app
  that gives a station's page real access to the PC's own hardware: serial
  ports (RS232 readers, scales), a shared MQTT connection, and network/raw
  printers (IPP, ZPL, ESC/POS). The Player never bundles its own copy of the
  station UI — it always loads the live page from your Manufactoo server, so
  a station's design updates reach every shop-floor PC instantly.

### Installing it in a company

1. An admin builds or downloads the installer (`npm run dist:win` inside
   `electron-player/`, or a `.exe`/`.dmg`/`.AppImage` already published to
   your Manufactoo server) and runs it on the shop-floor PC.
2. On first launch, the Player shows a **pairing code** on screen and starts
   polling your Manufactoo server.
3. In Manufactoo, go to **Estaciones > Players**: the new Player appears as
   *pending*, showing the same code. Assign it to a station (and optionally
   rename it, e.g. "Puesto montaje 3").
4. The Player picks up the assignment within a few seconds, stores its
   device credential locally (encrypted with the OS's own credential store
   via Electron's `safeStorage`), and opens that station full-screen. From
   then on it always opens that station on boot — reassigning it to a
   different station is done from the panel, not by touching the PC again.

No user password ever touches the Player: it authenticates as a *device*
(`X-Player-Token`), not as a person.

### Accessing local devices (RS232, MQTT, printers)

Once paired, the Player reads the same **Devices** and **Events** you
configured in Manufactoo and opens the matching native connection itself
(serial port for `SERIAL`, a shared MQTT client for `Events`, raw TCP or IPP
for printers) — a station's design doesn't change depending on whether it
runs in a browser or in the Player; the same field that shows "escanea o
pega el código" in a browser fills in automatically the instant real data
arrives when opened through the Player.

### Keeping both sides updated without breaking anything

Two independent things can be upgraded over time, and each is designed to
tolerate the other being on a different version:

- **The MES itself** (backend + station designs) — updates take effect
  immediately for every station, browser or Player, because the Player never
  caches the UI; it just reloads whatever the server currently serves.
- **The Manufactoo Player app** — a native shell that occasionally needs a
  new version (a newer Electron, a new device transport). Admins publish new
  installers from **Estaciones > Players** (or `POST /api/player-releases`);
  every Player checks that feed — hosted by your own Manufactoo server, never
  the public internet — and updates itself in the background, applying the
  update the next time it's closed (a shift change, a reboot), never mid-task.

The contract between the two (`window.manufactoo`, see
`frontend/src/features/stations/manufactoo-bridge.ts` and
`electron-player/src/preload/index.js`) is deliberately **additive**: a new
Player capability is a new field, never a change to an existing one, and the
station UI checks capabilities instead of assuming an exact Player version.
That's what lets an older Player and a newer MES (or vice versa) keep working
together correctly while a company rolls out updates gradually across its
shop floor.
