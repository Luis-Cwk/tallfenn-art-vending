# Guion para grabar el video (Tall Fenn, 2 minutos)

Grabas tú con OBS. Meta: **2:00, horizontal 16:9, 1080p**. Si te pasas, corta al final; no hace falta que sea perfecto, sí que se entienda.

## Antes de grabar (5 minutos)

1. **Compra tu edición 2** de `masas|premium|003` (2.00 USDC. Tienes saldo; el agente ya minteó la edición 1).
   https://tallfenn-art-vending.petrasynthetic.workers.dev (Galería → obra 02 → *acquire*)
   Si MetaMask dice "sitio malicioso" (falso positivo de Blockaid), usa Rabby o pulsa "continuar de todas formas".
2. **OBS > Ajustes > Video** (tu OBS está configurado vertical, hay que cambiarlo solo para esta grabación):
   - Resolución base (lienzo): **1920x1080**
   - Resolución de salida: **1920x1080**
   - FPS: **30**
3. **OBS > Ajustes > Salida > Grabación**: formato **mp4**, codificador **NVENC** (o x264), calidad **Alta**. Ruta: la que uses siempre.
4. **Escena**: una sola fuente, **Captura de ventana** apuntando a **Google Chrome** (o Captura de pantalla). Deja Chrome maximizado: la pantalla es 2560x1440 (16:9), así que al escalar a 1920x1080 queda exacto.
5. Cierra notificaciones de Windows (o activa "Asistente de concentración") y no muestres saldos, correos ni claves.

## Grabación: 6 beats (con lo que hay que decir)

Narración en inglés (si prefieres mudo, avísame y le pongo subtítulos quemados con ffmpeg después).

### 0:00 - 0:10 · Apertura
Chrome en la galería con la obra premium moviéndose (carta 02 del catálogo: `masas|premium|003`).
> "This is Tall Fenn, a generative art vending machine on Arc. Buyers pay in USDC, and every sale splits automatically."

### 0:10 - 0:30 · Arc Studio
Tu proyecto de Studio, mostrando el historial del chat, el árbol de archivos (`contracts/ArtVendor.sol`, `contracts/test`, `src/`) y el preview.
> "Everything here was built in Arc Studio: the ArtVendor contract, its 35 Foundry tests and the frontend. Studio wrote and tested the contracts; the same artifact was deployed to Arc mainnet."

### 0:30 - 0:55 · La obra
Vuelve a la app. Con la obra premium destacada, **arrastra dentro del cuadro para orbitarla** (se nota que responde). Señala la ficha y la lista de ediciones minteadas. Pasa un segundo por la página **Semillas** (sección Premium).
> "Each artwork is born from a seed string stored onchain: the browser hashes it and renders deterministically, so the same seed always produces the same piece. This is Masas semiredondas, the premium collection: an orbital sculpture with two directions of light, veins of light and suspended dust. Every edition gets its own variant, and the list below reads the minted editions straight from the chain."

### 0:55 - 1:25 · El pago (mainnet)
Dos cosas, en este orden:
1. Tu compra de la edición 2 en la app (aprobación de USDC + compra).
2. El tx del agente (ya está en la cadena):
   https://explorer.arc.io/tx/0x2022eb85cacffb84b9f6f61f0b2ffeb9813d69a33bf9ef6d5d59ccba100641a3
> "The first edition of this work was minted by an AI agent: it read the contract, approved USDC and bought edition one with no human in the loop. This one is mine. A buy pulls exactly the price in USDC, splits it instantly, 80 percent to the artist and 20 percent to the collaborator, and mints an onchain receipt whose metadata carries the seed hash, the poster and a link to the live piece."

### 1:25 - 1:50 · Repartos
Pestaña **Splits** (Repartos): se ven los pagos (1.60 y 0.40 USDC por venta de 2.00).
> "This ledger reads the payout events straight from the chain. No intermediary, no custody."

### 1:50 - 2:00 · Cierre
Pestaña **Artist** o la página del contrato, y el repo:
- https://explorer.arc.io/address/0x1d9e2dd8cb1a709c75e04278b58945a25a5677c0
- https://github.com/Luis-Cwk/tallfenn-art-vending
> "Contract 0x1d9e2dd8cb1a709c75e04278b58945a25a5677c0 on Arc mainnet. Code on GitHub. Built with Arc Studio."

## Al terminar

1. Sube a **YouTube** con visibilidad **Unlisted**. Título: `Tall Fenn: Art Vending Machine on Arc (demo)`.
2. Pásame el enlace: yo lo pongo en el envío de DoraHacks y cierro el submission.

Si algo sale mal a mitad, no importa: graba ese beat otra vez y me mandas las dos partes; las pego con ffmpeg.

## Datos que puedes necesitar durante la grabación

- App: https://tallfenn-art-vending.petrasynthetic.workers.dev
- Contrato v4 (Arc mainnet): `0x1d9e2dd8cb1a709c75e04278b58945a25a5677c0`
- Tx del agente (edición 1): `0x2022eb85cacffb84b9f6f61f0b2ffeb9813d69a33bf9ef6d5d59ccba100641a3`
- Deploy v4: `0x9c7fcc5590196dbfe835aec9c70ff8ef649a1a627254322c2412a38d87536910`
- Obras en venta: `masas|genesis|001` 0.5 USDC x25 · `masas|premium|003` 2 USDC x5 · `masas|premium|011` 5 USDC x3
