/* ====================================================================
 * PDF Transaction Parser (ported from standalone working logic)
 * ====================================================================
 * The implementation below mirrors the standalone script provided by
 * the user. It exposes the same parsing behaviour while allowing the
 * surrounding app code to handle UI concerns (status/progress display
 * and rendering of results).
 * ==================================================================== */

// --- DEBUG MODE & LOGGING SYSTEM ---
window.PARSER_DEBUG_MODE = true;
window.PARSER_LOG_BUFFER = []; // Acumulador de logs

function addToLogBuffer(msg) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
  window.PARSER_LOG_BUFFER.push(`[${timestamp}] ${msg}`);
}

function debugLog(...args) {
  if (!window.PARSER_DEBUG_MODE) return;
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  console.log('[PARSER]', ...args);
  addToLogBuffer('[INFO] ' + msg);
}

function debugWarn(...args) {
  if (!window.PARSER_DEBUG_MODE) return;
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  console.warn('[PARSER]', ...args);
  addToLogBuffer('[WARN] ' + msg);
}

function debugGroup(label) {
  if (!window.PARSER_DEBUG_MODE) return;
  console.group(label);
  addToLogBuffer(`\n=== ${label} ===`);
}

function debugGroupEnd() {
  if (!window.PARSER_DEBUG_MODE) return;
  console.groupEnd();
  addToLogBuffer('=== END GROUP ===\n');
}

// Función para descargar el log acumulado
function downloadLogFile() {
  if (window.PARSER_LOG_BUFFER.length === 0) return;
  const blob = new Blob([window.PARSER_LOG_BUFFER.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'debug_log.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log('Log file downloaded.');
}

const PARSER_NOOP = () => {};

// --- Simple, Y-only footer band (adjust this) ---
const FOOTER_BOTTOM_BAND = 120; // points from the bottom to drop (try 150–220)

/**
 * Parse the entire PDF and extract cash & interest transactions.
 * @param {PDFDocumentProxy} pdf
 * @param {{ updateStatus?: Function, updateProgress?: Function, footerBandPx?: number }} options
 * @returns {Promise<{ cash: Array<object>, interest: Array<object> }>}
 */
async function parsePDF(pdf, options = {}) {
  window.PARSER_LOG_BUFFER = []; // Reset log buffer
  console.clear(); // Intentar limpiar consola visual
  debugLog('Starting PDF parsing session...');

  const updateStatus = options.updateStatus || PARSER_NOOP;
  const updateProgress = options.updateProgress || PARSER_NOOP;

  // allow runtime override for band size
  const footerBandPx = Number.isFinite(options.footerBandPx)
    ? options.footerBandPx
    : FOOTER_BOTTOM_BAND;

  updateStatus('Parsing PDF...');
  let allCashTransactions = [];
  let allInterestTransactions = [];
  let cashColumnBoundaries = null;
  let interestColumnBoundaries = null;

  let isParsingCash = false;
  let isParsingInterest = false;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    debugGroup(`Processing Page ${pageNum}`);
    updateStatus(`Processing page ${pageNum} of ${pdf.numPages}`);
    updateProgress(pageNum, pdf.numPages);

    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    let pageItems = textContent.items.map(item => ({
      text: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      height: item.height,
    }));
    debugLog(`Page ${pageNum}: Found ${pageItems.length} total text items.`);

    // --- Simple Y-only footer clipping ---
    const footerY = footerBandPx;
    let items = pageItems.filter(it => it.y > footerY);

    if (window.PARSER_DEBUG_MODE) {
        const dropped = pageItems.filter(it => it.y <= footerY);
        if (dropped.length > 0) {
            debugLog(`Dropped ${dropped.length} items due to footer (y <= ${footerY}). Examples: ${dropped.slice(0,3).map(i=>i.text).join('|')}...`);
        }
    }

    // --- Section markers ---
    const cashStartMarker = items.find(item => {
      const t = normalizeText(item.text.trim());
      return t === 'UMSATZÜBERSICHT' || t === 'TRANSAZIONI SUL CONTO' || t === 'ACCOUNT TRANSACTIONS' ||
             t.includes('RESUMEN') && t.includes('MOVIMIENT') || t.includes('TRANSACCION') || t.includes('TRANSACCIONES') || t.includes('RESUMEN DE CUENTA') || t.includes('TRANSACCIONES DE CUENTA');
    });

    const cashEndMarker = items.find(item => {
      const t = normalizeText(item.text.trim());
      return t.includes('BARMITTELUEBERSICHT') || t.includes('CASH SUMMARY') || t.includes('BALANCE OVERVIEW') ||
             t.includes('RESUMEN') && t.includes('SALDO') || t.includes('RESUMEN DEL BALANCE') || t === 'SALDO';
    });

    if (cashStartMarker) debugLog('Found Cash Start Marker:', cashStartMarker.text);
    if (cashEndMarker) debugLog('Found Cash End Marker:', cashEndMarker.text);

    const shouldProcessCash = isParsingCash || !!cashStartMarker;

    const interestStartMarker = items.find(item => {
      const t = normalizeText(item.text.trim());
      return t === 'TRANSAKTIONSUEBERSICHT' || t === 'TRANSACTION OVERVIEW' || t === 'TRANSACTIONS' ||
             t.includes('RESUMEN') && t.includes('TRANSACC') || t.includes('DETALLE') || t.includes('MOVIMIENT');
    });

    const interestEndMarker = items.find(item => {
      const t = normalizeText(item.text.trim());
      return t.includes('HINWEISE ZUM KONTOAUSZUG') || t.includes('NOTES TO ACCOUNT STATEMENT') || t.includes('ACCOUNT STATEMENT NOTES') ||
             t.includes('NOTAS') && t.includes('EXTRACTO') || t.includes('NOTAS SOBRE') || t.includes('NOTAS DEL EXTRACTO') || t.includes('NOTAS AL EXTRACTO');
    });

    if (interestStartMarker) debugLog('Found Interest Start Marker:', interestStartMarker.text);
    if (interestEndMarker) debugLog('Found Interest End Marker:', interestEndMarker.text);

    const shouldProcessInterest = isParsingInterest || !!interestStartMarker;

    // --- Cash Transaction Parsing Logic ---
    if (shouldProcessCash) {
      debugGroup('Cash Section Logic');
      let cashItems = [...items];
      if (cashStartMarker) {
        cashItems = cashItems.filter(item => item.y <= cashStartMarker.y);
      }
      if (cashEndMarker) {
        cashItems = cashItems.filter(item => item.y > cashEndMarker.y);
      }

      let cashHeaders = findCashHeaders(cashItems);
      if (cashHeaders) {
        cashColumnBoundaries = calculateCashColumnBoundaries(cashHeaders);
        debugLog('Found new Cash headers/boundaries:', cashColumnBoundaries);
      }

      if (cashColumnBoundaries) {
        const pageCashTransactions = extractTransactionsFromPage(cashItems, cashColumnBoundaries, 'cash');
        debugLog(`Page ${pageNum}: Extracted ${pageCashTransactions.length} cash transactions.`);
        allCashTransactions = allCashTransactions.concat(pageCashTransactions);
      } else {
          debugWarn('Skipping cash extraction: No column boundaries defined yet.');
      }
      debugGroupEnd();
    }
    if (cashEndMarker) {
      isParsingCash = false;
    } else if (shouldProcessCash) {
      isParsingCash = true;
    }

    // --- Interest Transaction Parsing Logic ---
    if (shouldProcessInterest) {
      debugGroup('Interest Section Logic');
      let interestItems = [...items];
      if (interestStartMarker) {
        interestItems = interestItems.filter(item => item.y <= interestStartMarker.y);
      }
      if (interestEndMarker) {
        interestItems = interestItems.filter(item => item.y > interestEndMarker.y);
      }

      let interestHeaders = findInterestHeaders(interestItems);
      if (interestHeaders) {
        interestColumnBoundaries = calculateInterestColumnBoundaries(interestHeaders);
        debugLog('Found new Interest headers/boundaries:', interestColumnBoundaries);
      }

      if (interestColumnBoundaries) {
        const pageInterestTransactions = extractTransactionsFromPage(interestItems, interestColumnBoundaries, 'interest');
        debugLog(`Page ${pageNum}: Extracted ${pageInterestTransactions.length} interest transactions.`);
        allInterestTransactions = allInterestTransactions.concat(pageInterestTransactions);
      } else {
          debugWarn('Skipping interest extraction: No column boundaries defined yet.');
      }
      debugGroupEnd();
    }
    if (interestEndMarker) {
      isParsingInterest = false;
    } else if (shouldProcessInterest) {
      isParsingInterest = true;
    }

    debugGroupEnd(); // End Page Group
  }

  debugLog(`Total cash transactions: ${allCashTransactions.length}`);
  debugLog(`Total interest transactions: ${allInterestTransactions.length}`);

  // Trigger log download
  downloadLogFile();

  // Map German keys to English and split description into isin, name, quantity
  function parseDateToISO(s) {
    if (!s || typeof s !== 'string') return null;
    const raw = s.replace(/\s+/g, ' ').trim();
    // try to match formats like '14 ago 2024' or '03 DIC 2024' or '03 dic'
    const m = raw.match(/(\d{1,2})\s+([A-Za-zÀ-Üà-ü\.\-]+)\s*(\d{4})?/);
    if (!m) return null;
    const day = parseInt(m[1], 10);
    const monToken = m[2].replace(/\./g, '').toLowerCase();
    const year = m[3] ? parseInt(m[3], 10) : null;
    const months = {
      // spanish
      ene:0, enero:0, feb:1, febrero:1, mar:2, marzo:2, abr:3, abril:3, may:4, mayo:4, jun:5, junio:5, jul:6, julio:6, ago:7, agosto:7,
      sep:8, sept:8, septiembre:8, oct:9, octubre:9, nov:10, noviembre:10, dic:11, diciembre:11,
      // english abbrev/full
      jan:0,january:0,february:1,feb:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11,
      // german/italian common
      jan:0,feb:1,mar:2,apr:3,mai:4,jun:5,jul:6,aug:7,sep:8,okt:9,oct:9,nov:10,dez:11,dec:11
    };
    let mIdx = null;
    // try variations (first 3 letters)
    const t3 = monToken.slice(0,3);
    if (monToken in months) mIdx = months[monToken];
    else if (t3 in months) mIdx = months[t3];
    if (mIdx === null || mIdx === undefined) return null;
    const y = year || (new Date()).getFullYear();
    // build ISO date
    const mm = String(mIdx + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }

  function parseDescriptionFields(desc) {
    if (!desc || typeof desc !== 'string') return { description: '', isin: null, name: null, quantity: null };
    let d = desc.trim();

    // Extract quantity (quantity: 0.523494 or cantidad: 0,523) - be permissive
    let quantity = null;
    const qtyMatch = d.match(/(?:quantity|cantidad|qty|amount|unidades|unidad)[:\s]+([0-9]+[\.,]?[0-9]*)/i);
    if (qtyMatch) {
      const raw = qtyMatch[1].replace(/,/g, '.');
      quantity = parseFloat(raw);
      d = d.replace(qtyMatch[0], '');
    } else {
      // trailing 'quantity: x' after comma
      const trailing = d.match(/,?\s*quantity[:\s]+([0-9]+[\.,]?[0-9]*)$/i);
      if (trailing) {
        quantity = parseFloat(trailing[1].replace(/,/g, '.'));
        d = d.replace(trailing[0], '');
      }
    }

    // Extract ISIN-like token (2 letters + 9 alnum + digit -> 12 chars) or other common ids (XF...)
    let isin = null;
    const isinMatch = d.match(/\b([A-Z]{2}[A-Z0-9]{9}[0-9])\b/i);
    if (isinMatch) {
      isin = isinMatch[1].toUpperCase();
      d = d.replace(isinMatch[0], '');
    } else {
      // match tokens like XF000BTC0017 or US0231351067
      const altIsin = d.match(/\b([A-Z]{1,2}[0-9A-Z\-]{6,})\b/);
      if (altIsin) {
        const cand = altIsin[1].toUpperCase();
        if (/[A-Z]{1,2}\d/.test(cand)) {
          isin = cand;
          d = d.replace(altIsin[0], '');
        }
      }
    }

    // Remove common action prefixes in multiple languages
    d = d.replace(/^(Savings plan execution|Buy trade|Ejecución Compra directa|Ejecución Compra|Ejecución Venta directa|Venta|Sell trade|Ejecutar|Operar|Operacion|Operación|Trade:\s*|Ingreso aceptado:|Ingreso aceptado)\s*/i, '');

    // Clean leftover punctuation and extra spaces
    const name = d.replace(/\s{2,}/g, ' ').replace(/^[\s,:-]+|[\s,:-]+$/g, '').trim();

    const shortDescription = desc.trim().replace(/\s{2,}/g,' ');
    return { description: shortDescription, isin: isin || null, name: name || null, quantity: Number.isFinite(quantity) ? quantity : null };
  }

  function mapCash(tx) {
    const parsed = parseDescriptionFields(tx.beschreibung || tx.description || '');
    const incomingRaw = tx.zahlungseingang || tx.incoming || null;
    const outgoingRaw = tx.zahlungsausgang || tx.outgoing || null;
    const balanceRaw = tx.saldo || tx.balance || null;

    const incoming_amount = parseCurrency(incomingRaw);
    const outgoing_amount = parseCurrency(outgoingRaw);
    const balance_amount = parseCurrency(balanceRaw);

    const dateRaw = tx.datum || tx.date || null;
    const date_iso = parseDateToISO(dateRaw);

    return {
      date: dateRaw || null,
      date_iso: date_iso,
      type: tx.typ || tx.type || null,
      description: parsed.description,
      isin: parsed.isin,
      name: parsed.name,
      quantity: parsed.quantity,
      incoming: incomingRaw || null,
      incoming_amount: incoming_amount,
      outgoing: outgoingRaw || null,
      outgoing_amount: outgoing_amount,
      balance: balanceRaw || null,
      balance_amount: balance_amount,
      _raw_row: tx._raw_row || null,
    };
  }

  function mapInterest(tx) {
    return {
      date: tx.datum || null,
      type: tx.zahlungsart || tx.type || 'Interest',
      description: tx.geldmarktfonds || tx.description || null,
      amount: tx.betrag || null,
      quantity: tx.stueck || tx.quantity || null,
      price_per_unit: tx.kurs || tx.price || null,
      _raw_row: tx._raw_row || null,
    };
  }

  const englishCash = allCashTransactions.map(mapCash);
  const englishInterest = allInterestTransactions.map(mapInterest);

  return { cash: englishCash, interest: englishInterest };
}

// Normaliza texto: quita acentos, colapsa espacios y convierte a mayúsculas
function normalizeText(s) {
  if (!s || typeof s !== 'string') return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

// Helper: detecta si un string parece una fecha (ej: '14 ago 2024', '01 ene 2025' o contiene año 2024)
function isDateLike(s) {
  if (!s || typeof s !== 'string') return false;
  const raw = s.trim();
  // busca dd mon yyyy o yyyy
  const dayMonthYear = /\b\d{1,2}\s+[A-Z]{3,}|\b\d{1,2}\.\d{1,2}\.\d{4}/i; // día + mes-abrev o dd.mm.yyyy
  const year = /\b\d{4}\b/;
  return dayMonthYear.test(raw) || year.test(raw);
}

// --- Generic and Cash-Specific Functions ---
function findCashHeaders(items) {
  const headerKeywordsRaw = [
    'DATUM', 'TYP', 'BESCHREIBUNG', 'ZAHLUNGSEINGANG', 'ZAHLUNGSAUSGANG', 'SALDO',
    // Italian equivalents
    'DATA', 'TIPO', 'DESCRIZIONE', 'IN ENTRATA', 'IN USCITA',
    // English equivalents
    'DATE', 'TYPE', 'DESCRIPTION', 'MONEY', 'IN', 'OUT', 'BALANCE',
    // Spanish equivalents
    'FECHA', 'TIPO', 'DESCRIPCION', 'DESCRIPCIÓN', 'INGRESOS', 'INGRESO', 'EGRESOS', 'EGRESO', 'ABONOS', 'CARGOS', 'ENTRADA', 'SALIDA', 'IMPORTE', 'MONTO', 'ENTRADA DE', 'SALIDA DE'
  ];
  const headerKeywords = headerKeywordsRaw.map(k => normalizeText(k));

  const potentialHeaders = items.filter(item => {
    const raw = item.text.trim();
    const norm = normalizeText(raw);
    return raw.length > 2 &&
           // prefer lines that are mostly uppercase in the PDF extraction
           (raw === raw.toUpperCase() || norm.includes('FECHA') || norm.includes('TIPO')) &&
           headerKeywords.some(kw => norm.includes(kw));
  });

  debugLog('Potential headers found:', potentialHeaders.map(h => h.text.trim()));

  const matchAny = (labels) => {
    const norms = labels.map(l => normalizeText(l));
    return potentialHeaders.find(p => norms.includes(normalizeText(p.text.trim()))) || null;
  };

  // Helper to find headers that might be split into multiple text items (like "MONEY IN")
  const findCompositeHeader = (keyword1, keyword2) => {
    const kk1 = normalizeText(keyword1);
    const kk2 = normalizeText(keyword2);
    const single = potentialHeaders.find(p => {
      const t = normalizeText(p.text.trim());
      return t === `${kk1} ${kk2}` || t === kk1 + kk2;
    });
    if (single) return single;
    const first = potentialHeaders.filter(p => normalizeText(p.text.trim()) === kk1);
    for (const f of first) {
      const nearby = potentialHeaders.find(p => {
        return normalizeText(p.text.trim()) === kk2 &&
               Math.abs(p.y - f.y) < 2 &&
               p.x > f.x && p.x < f.x + 100;
      });
      if (nearby) {
        return {
          text: `${keyword1} ${keyword2}`,
          x: f.x,
          y: f.y,
          width: nearby.x + nearby.width - f.x,
          height: Math.max(f.height, nearby.height)
        };
      }
    }
    return null;
  };

  let headers = {
    DATUM: matchAny(['DATUM', 'DATA', 'DATE', 'FECHA']),
    TYP: matchAny(['TYP', 'TIPO', 'TYPE']),
    BESCHREIBUNG: matchAny(['BESCHREIBUNG', 'DESCRIZIONE', 'DESCRIPTION', 'DESCRIPCION', 'DESCRIPCIÓN']),
    ZAHLUNGEN: potentialHeaders.find(p => {
      const t = normalizeText(p.text.trim());
      return (t.includes('ZAHLUNGSEINGANG') && t.includes('ZAHLUNGSAUSGANG')) ||
             (t.includes('IN ENTRATA') && t.includes('IN USCITA')) ||
             (t.includes('MONEY IN') && t.includes('MONEY OUT')) ||
             (t.includes('INGRESOS') && t.includes('EGRESOS')) ||
             (t.includes('INGRESO') && t.includes('EGRESO')) ||
             (t.includes('ENTRADA') && t.includes('SALIDA')) ||
             (t.includes('ENTRADA DE') && t.includes('SALIDA DE'));
    }) || null,
    ZAHLUNGSEINGANG: null,
    ZAHLUNGSAUSGANG: null,
    SALDO: matchAny(['SALDO', 'BALANCE']),
  };

  if (!headers.ZAHLUNGEN) {
    headers.ZAHLUNGSEINGANG = matchAny(['ZAHLUNGSEINGANG', 'IN ENTRATA', 'INGRESOS', 'INGRESO', 'ENTRADA', 'ENTRADA DE']) || findCompositeHeader('MONEY', 'IN');
    headers.ZAHLUNGSAUSGANG = matchAny(['ZAHLUNGSAUSGANG', 'IN USCITA', 'EGRESOS', 'EGRESO', 'SALIDA', 'SALIDA DE']) || findCompositeHeader('MONEY', 'OUT');
  }

  debugLog('Matched headers:', {
    DATUM: headers.DATUM?.text,
    TYP: headers.TYP?.text,
    BESCHREIBUNG: headers.BESCHREIBUNG?.text,
    ZAHLUNGSEINGANG: headers.ZAHLUNGSEINGANG?.text,
    ZAHLUNGSAUSGANG: headers.ZAHLUNGSAUSGANG?.text,
    SALDO: headers.SALDO?.text
  });

  if (!headers.DATUM || !headers.TYP || !headers.BESCHREIBUNG || !headers.SALDO) return null;
  if (!headers.ZAHLUNGEN && (!headers.ZAHLUNGSEINGANG || !headers.ZAHLUNGSAUSGANG)) return null;
  return headers;
}

function calculateCashColumnBoundaries(headers) {
  let zahlungseingangEnd;
  let zahlungsausgangStart;
  let paymentsStart;

  if (headers.ZAHLUNGEN) {
    const zahlungenMidpoint = headers.ZAHLUNGEN.x + headers.ZAHLUNGEN.width / 2;
    zahlungseingangEnd = zahlungenMidpoint;
    zahlungsausgangStart = zahlungenMidpoint;
    paymentsStart = headers.ZAHLUNGEN.x - 5;
  } else {
    zahlungseingangEnd = headers.ZAHLUNGSAUSGANG.x - 5;
    zahlungsausgangStart = headers.ZAHLUNGSAUSGANG.x - 5;
    paymentsStart = headers.ZAHLUNGSEINGANG.x - 5;
  }

  return {
    datum: { start: 0, end: headers.TYP.x - 5 },
    typ: { start: headers.TYP.x - 5, end: headers.BESCHREIBUNG.x - 5 },
    beschreibung: { start: headers.BESCHREIBUNG.x - 5, end: paymentsStart },
    zahlungseingang: { start: paymentsStart, end: zahlungseingangEnd },
    zahlungsausgang: { start: zahlungsausgangStart, end: headers.SALDO.x - 5 },
    saldo: { start: headers.SALDO.x - 5, end: Infinity },
    headerY: headers.DATUM.y,
  };
}

// --- Interest-Specific Functions ---
function findInterestHeaders(items) {
  const headerKeywordsRaw = ['DATUM', 'ZAHLUNGSART', 'GELDMARKTFONDS', 'STÜCK', 'STUECK', 'KURS PRO STÜCK', 'BETRAG',
    // Spanish
    'FECHA', 'TIPO', 'FONDO', 'FONDOS', 'UNIDADES', 'UNIDAD', 'PRECIO', 'PRECIO POR UNIDAD', 'IMPORTE', 'MONTO'];
  const headerKeywords = headerKeywordsRaw.map(k => normalizeText(k));

  const potentialHeaders = items.filter(item => {
    const raw = item.text.trim();
    const norm = normalizeText(raw);
    return raw.length > 2 && headerKeywords.some(kw => norm.includes(kw));
  });

  const matchAny = (labels) => {
    const norms = labels.map(l => normalizeText(l));
    return potentialHeaders.find(p => norms.includes(normalizeText(p.text.trim()))) || null;
  };

  let headers = {
    DATUM: matchAny(['DATUM']) || matchAny(['FECHA']),
    ZAHLUNGSART: matchAny(['ZAHLUNGSART']) || matchAny(['TIPO']) || matchAny(['TIPO DE PAGO']),
    GELDMARKTFONDS: matchAny(['GELDMARKTFONDS']) || matchAny(['FONDO']) || matchAny(['FONDOS']) || matchAny(['FONDO DEL MERCADO MONETARIO']),
    STÜCK: matchAny(['STÜCK', 'STUECK']) || matchAny(['UNIDADES', 'UNIDAD', 'CANTIDAD']),
    'KURS PRO STÜCK': matchAny(['KURS PRO STÜCK']) || matchAny(['PRECIO POR UNIDAD']) || matchAny(['PRECIO']) || matchAny(['PRECIO/UNIDAD']),
    BETRAG: matchAny(['BETRAG']) || matchAny(['IMPORTE']) || matchAny(['MONTO']),
  };

  if (Object.values(headers).some(h => !h)) {
    return null;
  }
  return headers;
}

function calculateInterestColumnBoundaries(headers) {
  return {
    datum: { start: 0, end: headers.ZAHLUNGSART.x - 5 },
    zahlungsart: { start: headers.ZAHLUNGSART.x - 5, end: headers.GELDMARKTFONDS.x - 5 },
    geldmarktfonds: { start: headers.GELDMARKTFONDS.x - 5, end: headers.STÜCK.x - 5 },
    stueck: { start: headers.STÜCK.x - 5, end: headers['KURS PRO STÜCK'].x - 5 },
    kurs: { start: headers['KURS PRO STÜCK'].x - 5, end: headers.BETRAG.x - 5 },
    betrag: { start: headers.BETRAG.x - 5, end: Infinity },
    headerY: headers.DATUM.y,
  };
}

// --- Generic Transaction Extraction ---
function extractTransactionsFromPage(items, boundaries, type) {
  debugGroup(`Extracting ${type} transactions from ${items.length} items`);

  // Filter items above the header
  const contentItems = items.filter(item => item.y < boundaries.headerY - 5 && item.text.trim() !== '');

  if (window.PARSER_DEBUG_MODE) {
      const ignored = items.filter(item => item.y >= boundaries.headerY - 5);
      if (ignored.length > 0) {
          debugLog(`Ignored ${ignored.length} items above or at header level (y >= ${boundaries.headerY - 5})`);
      }
      // LOG DE TEXTO BRUTO (RAW ITEMS)
      debugLog('--- RAW CONTENT ITEMS (Pre-Grouping) ---');
      contentItems.forEach((item, idx) => {
          debugLog(`Item[${idx}]: "${item.text}" (x:${item.x.toFixed(1)}, y:${item.y.toFixed(1)})`);
      });
      debugLog('----------------------------------------');
  }

  if (contentItems.length === 0) {
      debugLog('No content items found below header.');
      debugGroupEnd();
      return [];
  }

  contentItems.sort((a, b) => b.y - a.y || a.x - b.x);

  const rows = [];
  if (contentItems.length > 0) {
    const avgHeight = contentItems.reduce((sum, item) => sum + item.height, 0) / contentItems.length || 10;
    const gapThreshold = avgHeight * 1.5;

    debugLog(`Row grouping: avgHeight=${avgHeight.toFixed(2)}, gapThreshold=${gapThreshold.toFixed(2)}`);

    let currentRow = [contentItems[0]];
    for (let i = 1; i < contentItems.length; i++) {
      const gap = contentItems[i - 1].y - contentItems[i].y;
      if (gap > gapThreshold) {
        rows.push(currentRow);
        currentRow = [];
      }
      currentRow.push(contentItems[i]);
    }
    rows.push(currentRow);
  }

  debugLog(`Formed ${rows.length} raw rows.`);

  const transactions = [];
  for (const [rowIndex, rowItems] of rows.entries()) {
    let transaction = {};

    if (type === 'cash') {
      transaction = {
        datum: '',
        typ: '',
        beschreibung: '',
        zahlungseingang: '',
        zahlungsausgang: '',
        saldo: '',
      };
      const financialItems = [];
      for (const item of rowItems) {
        if (item.x < boundaries.datum.end) transaction.datum += ' ' + item.text;
        else if (item.x < boundaries.typ.end) transaction.typ += ' ' + item.text;
        else if (item.x < boundaries.beschreibung.end) transaction.beschreibung += ' ' + item.text;
        else financialItems.push(item);
      }
      financialItems.sort((a, b) => a.x - b.x);
      if (financialItems.length > 0) transaction.saldo = financialItems.pop().text;
      for (const item of financialItems) {
        if (item.x < boundaries.zahlungseingang.end) transaction.zahlungseingang += ' ' + item.text;
        else if (item.x < boundaries.zahlungsausgang.end) transaction.zahlungsausgang += ' ' + item.text;
      }
    } else if (type === 'interest') {
      transaction = {
        datum: '',
        zahlungsart: '',
        geldmarktfonds: '',
        stueck: '',
        kurs: '',
        betrag: '',
      };
      const otherItems = [];
      for (const item of rowItems) {
        if (item.x < boundaries.datum.end) transaction.datum += ' ' + item.text;
        else if (item.x < boundaries.zahlungsart.end) transaction.zahlungsart += ' ' + item.text;
        else if (item.x < boundaries.geldmarktfonds.end) transaction.geldmarktfonds += ' ' + item.text;
        else otherItems.push(item);
      }
      otherItems.sort((a, b) => a.x - b.x);
      if (otherItems.length > 0) {
        const betragItem = otherItems.pop();
        transaction.betrag = betragItem.text;
      }
      for (const item of otherItems) {
        if (item.x < boundaries.stueck.end) transaction.stueck += ' ' + item.text;
        else if (item.x < boundaries.kurs.end) transaction.kurs += ' ' + item.text;
      }
    }

    Object.keys(transaction).forEach(key => {
      transaction[key] = transaction[key].trim().replace(/\s+/g, ' ');
    });

    // Filtrar filas que no parecen transacciones (sin fecha reconocible y sin saldo)
    if (!isDateLike(transaction.datum) && !transaction.saldo) {
      if (window.PARSER_DEBUG_MODE) {
          debugLog(`Row ${rowIndex} REJECTED (no date/balance):`,
              JSON.stringify(transaction),
              'Raw items:', rowItems.map(i => `"${i.text}" (x:${i.x.toFixed(1)})`).join(', ')
          );
      }
      continue; // saltar
    }

    if (Object.values(transaction).some(val => val !== '')) {
      transactions.push(transaction);
      if (window.PARSER_DEBUG_MODE) {
          debugLog(`Row ${rowIndex} ACCEPTED:`, JSON.stringify(transaction));
      }
    }
  }
  debugGroupEnd();
  return transactions;
}

function parseCurrency(str) {
  if (!str || typeof str !== 'string') return 0;
  const cleanStr = str
    .replace(/€/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.');
  return isNaN(parseFloat(cleanStr)) ? 0 : parseFloat(cleanStr);
}

/**
 * Attach derived metadata (optional helper, used by UI layer).
 */
function computeCashSanityChecks(transactions) {
  let failedChecks = 0;
  const enhancedTransactions = transactions.map((t, index, list) => {
    let sanityCheckOk = true;
    if (index > 0) {
      const prevSaldo = parseCurrency(list[index - 1].saldo);
      const eingang = parseCurrency(t.zahlungseingang);
      const ausgang = parseCurrency(t.zahlungsausgang);
      const currentSaldo = parseCurrency(t.saldo);
      if (!isNaN(prevSaldo) && !isNaN(currentSaldo)) {
        const expectedSaldo = prevSaldo + eingang - ausgang;
        if (Math.abs(expectedSaldo - currentSaldo) > 0.02) {
          sanityCheckOk = false;
          failedChecks++;
        }
      }
    }
    return { ...t, _sanityCheckOk: sanityCheckOk };
  });
  return { transactions: enhancedTransactions, failedChecks };
}

// expose helper so other modules can reuse sanity information
window.parsePDF = parsePDF;
window.parseCurrency = parseCurrency;
window.computeCashSanityChecks = computeCashSanityChecks;
window.findCashHeaders = findCashHeaders;
window.findInterestHeaders = findInterestHeaders;
