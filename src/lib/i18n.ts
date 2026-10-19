/**
 * i18n: all UI strings for Tall Fenn.
 * Artwork titles, series names, seed strings, and the artist name
 * are NOT translated (they are proper nouns / titles).
 */

export type Lang = 'en' | 'es'

export const STRINGS = {
  en: {
    // Nav
    nav_gallery: 'Gallery',
    nav_seeds: 'Seeds',
    nav_splits: 'Splits',
    nav_artist: 'Artist',
    nav_how: 'How it works',
    nav_testnet: 'mainnet',

    // Wallet
    connect_wallet: 'Connect wallet',
    wrong_chain: 'Switch to Arc',
    wallet_connected: 'Connected',

    // Gallery
    featured_label: 'Featured work',
    artist_name: 'Tall Fenn',
    edition_of: (n: number, total: number) => `Edition ${n} of ${total}`,
    editions_left: (n: number, total: number) => `${n} of ${total} available`,
    price_label: 'Price',
    acquire: 'acquire',
    sold_out: 'Sold out',
    series_label: 'Series',
    seed_label: 'Seed',
    catalogue_title: 'All works',
    editions_abbr: (n: number) => `${n} ed.`,
    loading: 'Loading…',
    no_works: 'No works listed yet.',
    generating: 'generating…',

    // Buy panel
    back_to_gallery: '← Gallery',
    available_editions: (n: number, total: number) => `${n} of ${total} editions available`,
    automatic_split: 'Automatic split',
    step_approve: 'Step 1: approve USDC spending.\nStep 2: confirm purchase.',
    usdc_approved: 'USDC approved. Confirm purchase.',
    purchase_confirmed: 'Purchase confirmed',
    receipt_edition: (n: number, token: string) => `Edition #${n} · Token #${token}`,
    view_explorer: 'View on explorer',
    confirm_purchase: 'Confirm purchase',
    retry: 'Try again',
    cta_connect: 'Connect wallet',
    cta_wrong_chain: 'Switch to Arc',
    cta_approving_wallet: 'Confirm in wallet…',
    cta_approving: 'Approving USDC…',
    cta_buying_wallet: 'Confirm in wallet…',
    cta_buying: 'Processing…',
    cta_needs_approval: 'Approve USDC & buy',
    cta_buy: 'Buy edition',

    // Errors
    err_cancelled: 'Transaction cancelled.',
    err_balance: 'Insufficient balance.',
    err_blocked: 'Address blocked by the USDC contract.',
    err_reverted: (reason: string) => `Transaction rejected: ${reason}`,
    err_owner: 'Only the contract owner can do this.',
    err_generic: 'Something went wrong. Please try again.',

    // Splits
    splits_title: 'Splits',
    splits_subtitle: 'Every sale distributes the payment automatically among the configured recipients. Data comes directly from the contract\'s PayoutSent events.',
    splits_loading: 'Reading onchain events…',
    splits_empty: 'No splits recorded since deployment.',
    splits_partial: 'Some block ranges could not be fetched; amounts may be incomplete.',
    splits_footer: 'Since deployment · Arc',
    col_recipient: 'Recipient',
    col_total: 'Total received',
    col_last: 'Last payout',
    col_count: 'Payouts',
    splits_error: 'Could not load payout events.',

    // Artist panel
    artist_title: 'Artist panel',
    owner_label: 'Contract owner',
    not_owner: 'Connected wallet is not the contract owner. Read-only.',
    list_artwork_title: 'Register work',
    price_usdc: 'Price (USDC)',
    editions_label: 'Editions',
    seed_input_label: 'Seed (seedInput)',
    seed_hint: 'Start with "masas|" for the shader engine; anything else for SVG.',
    series_name_label: 'Series name',
    recipients_label: 'Recipients and percentages',
    shares_hint: 'Percentages must add up to 100.',
    add_recipient: 'Add recipient',
    register_work: 'Register work',
    work_registered: 'Work registered on chain.',
    update_recipients_title: 'Update recipients',
    select_work: 'Select a work',
    update_btn: 'Update recipients',
    recipients_updated: 'Recipients updated.',
    address_placeholder: (i: number) => `Address ${i + 1}`,

    // Como funciona
    how_title: 'How it works',
    how_body: `The seed decides the work. Each piece is born from a text string: the seedInput. The browser computes sha256(seedInput + "|v1|tallfenn") and that same hash is recorded on the contract, so anyone can verify it. What you see on screen is deterministic: the same seed always produces the same image, on any device.

The hash stays on the chain. When a work is listed, the ArtVendor contract derives the seedHash onchain (Solidity's native sha256) and stores it permanently. The seed cannot be changed afterward; the hash certifies it.

Payment is split automatically. When someone buys, the contract transfers USDC instantly among the configured recipients (up to 4), proportional to their basis-point shares. No intermediary, no custody: funds never sit in the contract longer than necessary.

A human or an AI agent can buy. The contract does not distinguish between a wallet controlled by a person and one controlled by an AI agent. Any account with sufficient USDC that signs the transaction can acquire an edition. The vending machine runs 24/7, without permission.`,
    how_contract_label: 'Deployed contract',
    how_explorer: 'View on explorer',

    // Seeds page
    seeds_title: 'Seeds',
    seeds_studio_title: 'Study',
    seeds_premium_title: 'Premium',
    seeds_premium_intro: 'The premium collection: an orbital sculpture with two directions of light, double fresnel, veins of light, travelling bands and suspended dust. Drag inside the live view to orbit the piece.',
    seeds_palette: 'Palette',
    seeds_intro: 'Seed study. Each seed is a deterministic work. The pieces on sale live in the gallery.',
    seeds_back: '← Seeds',
    seeds_mode: 'Mode',
    seeds_hue: 'Hue',
    seeds_masses: 'Masses',

    // Minted editions + live view + agents
    minted_title: 'Minted editions',
    minted_empty: 'No editions minted yet.',
    minted_loading: 'Reading onchain sales…',
    minted_edition: 'Edition',
    minted_view: 'view',
    live_back: 'Gallery',
    live_not_found: 'No artwork onchain matches this hash',
    live_edition: 'edition',
    agents_title: 'For agents',
    agents_body: 'Any account with USDC on Arc can buy by calling buy(artworkId) on the contract. The repository ships a ready-to-run script, and llms.txt describes the flow in machine-readable form.',
    agents_llms: 'llms.txt',
    agents_script: 'agent-buy.mjs',

    // Footer
    lang_toggle_es: 'ES',
    lang_toggle_en: 'EN',
  },

  es: {
    nav_gallery: 'Galería',
    nav_seeds: 'Semillas',
    nav_splits: 'Repartos',
    nav_artist: 'Artista',
    nav_how: 'Cómo funciona',
    nav_testnet: 'mainnet',

    connect_wallet: 'Conectar cartera',
    wrong_chain: 'Cambiar a Arc',
    wallet_connected: 'Conectado',

    featured_label: 'Obra destacada',
    artist_name: 'Tall Fenn',
    edition_of: (n: number, total: number) => `Edición ${n} de ${total}`,
    editions_left: (n: number, total: number) => `${n} de ${total} disponibles`,
    price_label: 'Precio',
    acquire: 'adquirir',
    sold_out: 'Agotado',
    series_label: 'Serie',
    seed_label: 'Semilla',
    catalogue_title: 'Catálogo',
    editions_abbr: (n: number) => `${n} ed.`,
    loading: 'Cargando…',
    no_works: 'No hay obras disponibles todavía.',
    generating: 'generando…',

    back_to_gallery: '← Galería',
    available_editions: (n: number, total: number) => `${n} de ${total} ediciones disponibles`,
    automatic_split: 'Reparto automático',
    step_approve: 'Paso 1: permitir gasto de USDC.\nPaso 2: confirmar compra.',
    usdc_approved: 'USDC aprobado. Confirma la compra.',
    purchase_confirmed: 'Compra confirmada',
    receipt_edition: (n: number, token: string) => `Edición #${n} · Token #${token}`,
    view_explorer: 'Ver en explorer',
    confirm_purchase: 'Confirmar compra',
    retry: 'Intentar de nuevo',
    cta_connect: 'Conectar cartera',
    cta_wrong_chain: 'Cambiar a Arc',
    cta_approving_wallet: 'Confirma en tu cartera…',
    cta_approving: 'Aprobando USDC…',
    cta_buying_wallet: 'Confirma en tu cartera…',
    cta_buying: 'Procesando…',
    cta_needs_approval: 'Permitir USDC y comprar',
    cta_buy: 'Comprar edición',

    err_cancelled: 'Transacción cancelada.',
    err_balance: 'Saldo insuficiente.',
    err_blocked: 'Dirección bloqueada por el contrato USDC.',
    err_reverted: (reason: string) => `Transacción rechazada: ${reason}`,
    err_owner: 'Solo el propietario puede hacer esto.',
    err_generic: 'Algo salió mal. Intenta de nuevo.',

    splits_title: 'Repartos',
    splits_subtitle: 'Cada venta reparte el pago automáticamente entre los destinatarios configurados. Los datos vienen directamente de los eventos PayoutSent del contrato.',
    splits_loading: 'Leyendo eventos onchain…',
    splits_empty: 'Ningún reparto registrado desde el despliegue.',
    splits_partial: 'Algunos rangos de bloques no se pudieron obtener; los totales pueden estar incompletos.',
    splits_footer: 'Desde el despliegue · Arc',
    col_recipient: 'Destinatario',
    col_total: 'Total recibido',
    col_last: 'Último pago',
    col_count: 'Pagos',
    splits_error: 'No se pudieron cargar los eventos de reparto.',

    artist_title: 'Panel del artista',
    owner_label: 'Propietario del contrato',
    not_owner: 'La cartera conectada no es la propietaria. Solo lectura.',
    list_artwork_title: 'Registrar obra',
    price_usdc: 'Precio (USDC)',
    editions_label: 'Ediciones',
    seed_input_label: 'Semilla (seedInput)',
    seed_hint: 'Empieza con "masas|" para motor shader; cualquier otro para SVG.',
    series_name_label: 'Nombre de la serie',
    recipients_label: 'Destinatarios y porcentajes',
    shares_hint: 'Los porcentajes deben sumar 100.',
    add_recipient: 'Añadir destinatario',
    register_work: 'Registrar obra',
    work_registered: 'Obra registrada en la cadena.',
    update_recipients_title: 'Actualizar destinatarios',
    select_work: 'Selecciona una obra',
    update_btn: 'Actualizar destinatarios',
    recipients_updated: 'Destinatarios actualizados.',
    address_placeholder: (i: number) => `Dirección ${i + 1}`,

    how_title: 'Cómo funciona',
    how_body: `La semilla decide la obra. Cada pieza nace de una cadena de texto: la seedInput. El navegador calcula sha256(seedInput + "|v1|tallfenn") y el mismo hash está grabado en el contrato. Lo que ves en pantalla es determinista: la misma semilla produce siempre la misma imagen, en cualquier dispositivo.

El hash queda en la cadena. Al registrar una obra, el contrato ArtVendor deriva el seedHash onchain (sha256 nativo de Solidity) y lo almacena inmutablemente. Nadie puede sustituir la semilla después; el hash lo certifica.

El pago se reparte solo. Cuando alguien compra, el contrato transfiere el USDC al instante entre los destinatarios configurados (hasta 4), proporcional a sus fracciones en puntos base. No hay intermediario ni custodia: los fondos nunca pasan por el contrato más tiempo del necesario.

Puede comprar un humano o un agente de IA. El contrato no distingue entre una billetera controlada por una persona y una controlada por un agente de IA. Cualquier cuenta que tenga USDC suficiente y firme la transacción puede adquirir una edición. La máquina expendedora funciona 24/7, sin permiso.`,
    how_contract_label: 'Contrato desplegado',
    how_explorer: 'Ver en explorer',

    // Seeds page
    seeds_title: 'Semillas',
    seeds_studio_title: 'Estudio',
    seeds_premium_title: 'Premium',
    seeds_premium_intro: 'La colección premium: una escultura en órbita con dos direcciones de luz, doble fresnel, venas de luz, bandas viajeras y polvo suspendido. Arrastra dentro de la vista en vivo para orbitar la pieza.',
    seeds_palette: 'Paleta',
    seeds_intro: 'Estudio de semillas. Cada semilla es una obra determinista. Las piezas en venta están en la galería.',
    seeds_back: '← Semillas',
    seeds_mode: 'Modo',
    seeds_hue: 'Matiz',
    seeds_masses: 'Masas',

    // Ediciones minteadas + vista en vivo + agentes
    minted_title: 'Ediciones minteadas',
    minted_empty: 'Aún no hay ediciones minteadas.',
    minted_loading: 'Leyendo ventas onchain…',
    minted_edition: 'Edición',
    minted_view: 'ver',
    live_back: 'Galería',
    live_not_found: 'Ninguna obra en la cadena coincide con este hash',
    live_edition: 'edición',
    agents_title: 'Para agentes',
    agents_body: 'Cualquier cuenta con USDC en Arc puede comprar llamando buy(artworkId) en el contrato. El repositorio incluye un script listo para correr y llms.txt describe el flujo en formato legible por máquinas.',
    agents_llms: 'llms.txt',
    agents_script: 'agent-buy.mjs',

    lang_toggle_es: 'ES',
    lang_toggle_en: 'EN',
  },
} satisfies Record<Lang, Record<string, unknown>>

export type Strings = typeof STRINGS.en
