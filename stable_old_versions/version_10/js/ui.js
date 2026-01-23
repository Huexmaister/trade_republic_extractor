/* ===================== UI Components ===================== */

const BUTTON_BASE_CLASSES = 'inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-0';
const BUTTON_PRIMARY_CLASSES = 'inline-flex items-center justify-center rounded-md border border-transparent bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2';
const TAB_BASE_CLASSES = 'cursor-pointer rounded-t-md border border-transparent px-4 py-2 text-sm font-medium transition';
const TAB_ACTIVE_CLASSES = 'border-slate-200 border-b-white bg-white text-slate-900';
const TAB_INACTIVE_CLASSES = 'bg-slate-100 text-slate-600 hover:text-slate-900';
const TAB_CONTENT_BASE_CLASSES = 'border-t border-slate-200 p-6';

function applyTabStyles(tabElement, isActive) {
  tabElement.className = `${TAB_BASE_CLASSES} ${isActive ? TAB_ACTIVE_CLASSES : TAB_INACTIVE_CLASSES}`;
  tabElement.dataset.active = isActive ? 'true' : 'false';
}

function applyTabContentStyles(contentElement, isActive) {
  contentElement.className = `${TAB_CONTENT_BASE_CLASSES} ${isActive ? '' : 'hidden'}`;
  contentElement.dataset.active = isActive ? 'true' : 'false';
}
function createTabNavigationWithTrading(configOrCash, mmfComponent, tradingComponent) {
  const isConfigObject = configOrCash && typeof configOrCash === 'object' && !Array.isArray(configOrCash) && !configOrCash.nodeType;
  const {
    cash,
    charts,
    mmf,
    trading,
    support,
    onChartsActivate
  } = isConfigObject
    ? configOrCash
    : { cash: configOrCash, mmf: mmfComponent, trading: tradingComponent };

  const tabDefinitions = [
    { label: 'Transacciones de Efectivo', content: cash },
    { label: 'Gráficos', content: charts, onActivate: onChartsActivate },
    { label: 'Fondos Monetarios', content: mmf },
    { label: 'Trading P&L (Beta)', content: trading },
    { label: 'Resumen de Resultados', content: support }
  ].filter(def => def && def.content);

  if (tabDefinitions.length === 0) return null;

  const container = document.createElement('div');
  container.className = 'mt-10 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm';
  container.dataset.tabContainer = 'true';

  const tabs = document.createElement('div');
  tabs.className = 'flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 px-4 pt-4';
  container.appendChild(tabs);

  const components = [];

  const registerTab = ({ label, content, onActivate }) => {
    const isFirst = components.length === 0;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.textContent = label;
    tab.dataset.tabRole = 'navigation';
    tab.dataset.tabLabel = label;
    applyTabStyles(tab, isFirst);
    tabs.appendChild(tab);

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('space-y-6');
    applyTabContentStyles(contentDiv, isFirst);
    contentDiv.dataset.tabRole = 'panel';
    contentDiv.dataset.tabLabel = label;
    contentDiv.appendChild(content);
    container.appendChild(contentDiv);

    const entry = { tab, contentDiv, onActivate, activated: false };
    components.push(entry);

    if (isFirst && onActivate && !entry.activated) {
      entry.activated = true;
      setTimeout(onActivate, 0);
    }

    tab.addEventListener('click', () => {
      components.forEach(comp => {
        const active = comp === entry;
        applyTabStyles(comp.tab, active);
        applyTabContentStyles(comp.contentDiv, active);
      });
      if (entry.onActivate && !entry.activated) {
        entry.activated = true;
        setTimeout(entry.onActivate, 0);
      }
    });
  };

  tabDefinitions.forEach(registerTab);

  return container;
}

function createTabNavigation(cashComponent, mmfComponent) {
  return createTabNavigationWithTrading({ cash: cashComponent, mmf: mmfComponent });
}

function renderTradingComponent(tradingData, tradingTransactions) {
  const container = document.createElement('div');
  container.className = 'space-y-6';

  const betaNotice = document.createElement('div');
  betaNotice.className = 'flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900';
  betaNotice.innerHTML = `
    <div class="shrink-0 pt-[2px]">
      <span class="inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700">Beta</span>
    </div>
    <p class="leading-relaxed">El análisis de Trading P&L está actualmente en fase Beta. Los resultados pueden estar incompletos – ¡se agradecen los comentarios! <br><strong>Nota:</strong> Los cálculos tienen cierto margen de error en base a las comisiones y se presupone que el cálculo de impuestos de la App es correcto; si ese cálculo está mal, lo que hace la app también.</p>
  `;
  container.appendChild(betaNotice);

  // Use new FIFO calculation if available
  let fifoData = null;
  if (window.currentCashDisplay && typeof calculateTaxReport === 'function') {
    fifoData = calculateTaxReport(window.currentCashDisplay);
  }

  // Add Tax Report Buttons
  const taxButtonContainer = document.createElement('div');
  taxButtonContainer.className = 'flex flex-wrap items-center gap-3';

  const fifoButton = document.createElement('button');
  fifoButton.type = 'button';
  fifoButton.className = BUTTON_BASE_CLASSES;
  fifoButton.innerHTML = '<i data-feather="download" class="mr-2"></i> Descargar FIFO (JSON)';
  fifoButton.onclick = () => {
    if (fifoData) {
      const blob = new Blob([JSON.stringify(fifoData.fifoJson, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'operaciones_realizadas_fifo.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      alert('No hay datos disponibles.');
    }
  };
  taxButtonContainer.appendChild(fifoButton);

  const incomeButton = document.createElement('button');
  incomeButton.type = 'button';
  incomeButton.className = BUTTON_BASE_CLASSES;
  incomeButton.innerHTML = '<i data-feather="download" class="mr-2"></i> Descargar Ingresos (JSON)';
  incomeButton.onclick = () => {
    if (fifoData) {
      const blob = new Blob([JSON.stringify(fifoData.incomeJson, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ingresos_dividendos_intereses.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      alert('No hay datos disponibles.');
    }
  };
  taxButtonContainer.appendChild(incomeButton);
  container.appendChild(taxButtonContainer);

  // Render Tables based on FIFO Data
  if (fifoData) {
    // 1. Open Positions Table
    const openPositionsTitle = document.createElement('h3');
    openPositionsTitle.className = 'text-lg font-semibold text-slate-900 mt-6 mb-2';
    openPositionsTitle.textContent = 'POSICIONES ACTIVAS';
    container.appendChild(openPositionsTitle);

    if (fifoData.open.length > 0) {
      const openTableData = fifoData.open.map(pos => ({
        activo: pos.nombre,
        isin: pos.isin,
        cantidad: pos.cantidad.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 6 }),
        'coste_total_€': pos.coste_total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }),
        'precio_promedio_€': pos.precio_promedio.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
      }));
      container.appendChild(makeTable('Posiciones Abiertas (Cartera Actual)', openTableData));
    } else {
      const noOpenMsg = document.createElement('div');
      noOpenMsg.className = 'text-sm text-slate-600 italic';
      noOpenMsg.textContent = 'No se detectaron posiciones abiertas.';
      container.appendChild(noOpenMsg);
    }

    // 2. Realized P&L Table
    const realizedTitle = document.createElement('h3');
    realizedTitle.className = 'text-lg font-semibold text-slate-900 mt-6 mb-2';
    realizedTitle.textContent = 'Ganancias y Pérdidas históricas';
    container.appendChild(realizedTitle);

    if (fifoData.realized.length > 0) {
      // Sort by date descending
      const sortedRealized = [...fifoData.realized].sort((a, b) => new Date(b.fecha_venta) - new Date(a.fecha_venta));

      const realizedTableData = sortedRealized.map(tx => ({
        fecha: tx.fecha_venta,
        activo: tx.activo,
        isin: tx.isin,
        cantidad: tx.qty_vendida.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 6 }),
        'venta_neta_€': tx.importe_venta_neto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }),
        'coste_base_€': tx.coste_base.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }),
        'resultado_€': tx.resultado_bruto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }),
        estado: tx.es_perdida ? 'Pérdida' : 'Ganancia',
        _isLoss: tx.es_perdida // Flag for styling
      }));
      container.appendChild(makeTable('Ganancias y Pérdidas Realizadas (FIFO)', realizedTableData));
    } else {
      const noRealizedMsg = document.createElement('div');
      noRealizedMsg.className = 'text-sm text-slate-600 italic';
      noRealizedMsg.textContent = 'No se detectaron operaciones cerradas.';
      container.appendChild(noRealizedMsg);
    }
  }

  const explanationEl = document.createElement('div');
  explanationEl.className = 'space-y-4';
  explanationEl.innerHTML = `
    <div class="rounded-lg border border-slate-200 bg-slate-50 p-5 space-y-3 text-sm text-slate-700">
      <h4 class="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <i data-feather="info"></i>
        Nota sobre el cálculo FIFO:
      </h4>
      <ul class="space-y-1 list-disc pl-5">
        <li>El cálculo se basa exclusivamente en el historial de transacciones detectado en el PDF.</li>
        <li><strong>Posiciones Abiertas:</strong> Muestra lo que queda en cartera tras restar las ventas a las compras.</li>
        <li><strong>Resultado:</strong> Se calcula como (Importe Neto Venta - Coste de Adquisición FIFO).</li>
        <li>Si el resultado es negativo, indica una pérdida patrimonial.</li>
      </ul>
    </div>
  `;
  container.appendChild(explanationEl);

  setTimeout(() => {
    if (typeof feather !== 'undefined') {
      feather.replace();
    }
  }, 100);

  return container;
}

function renderComponent(title, rows, prefix, options = {}) {
  const container = document.createElement('div');
  container.className = 'space-y-4';

  // Only show JSON export button for Cash Transactions
  const bar = document.createElement('div');
  bar.className = 'flex flex-wrap items-center gap-3';

  const mkBtn = (txt, cb) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = BUTTON_BASE_CLASSES;
    b.textContent = txt;
    b.onclick = cb;
    bar.appendChild(b);
  };

  // Custom download function for JSON to control filename
  const downloadJson = (data, filename) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  mkBtn('Exportar Extracto (JSON)', () => downloadJson(rows, 'extracto.json'));
  container.appendChild(bar);
  
  // Simplified statistics for this table
  const detailStats = document.createElement('div');
  detailStats.className = 'text-sm text-slate-600';
  
  let statsText = `<strong class="font-semibold text-slate-900">${rows.length} transacciones encontradas.</strong>`;
  if (typeof options.failedChecks === 'number') {
    if (options.failedChecks > 0) {
      statsText += ` <span class="text-red-600">(${options.failedChecks} errores de comprobación)</span>`;
    } else if (rows.length > 0) {
      statsText += ' <span class="text-emerald-600">(todos los cálculos consistentes)</span>';
    }
  }
  
  detailStats.innerHTML = statsText;
  container.appendChild(detailStats);

  // Filter rows for Cash Transactions table
  let displayRows = rows;
  if (prefix === 'cash') {
      displayRows = rows
          .filter(r => r.date_iso) // Only show rows with date_iso
          .map(r => ({
              date_iso: r.date_iso,
              type: r.type,
              name: r.name,
              quantity: r.quantity,
              incoming: r.incoming,
              outgoing: r.outgoing,
              _sanityCheckOk: r._sanityCheckOk // Preserve sanity check flag
          }));
  }

  // Add table
  container.appendChild(makeTable(title, displayRows));
  return container;
}

function renderSupportComponent({ cashCount = 0, mmfCount = 0, tradingCount = 0, failedChecks = 0 } = {}) {
  const container = document.createElement('div');
  container.className = 'space-y-6';

  const summary = document.createElement('div');
  summary.className = 'rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700';
  const total = cashCount + mmfCount + tradingCount;
  summary.innerHTML = `
    <h3 class="text-base font-semibold text-slate-900">Análisis completado</h3>
    <p class="mt-2 leading-relaxed">Se detectaron <strong>${total}</strong> registros${
      failedChecks > 0
        ? ` – por favor revisa <strong>${failedChecks}</strong> saldos marcados en las tablas.`
        : '.'
    } Puedes exportar los datos nuevamente o procesar más PDFs.</p>
  `;
  container.appendChild(summary);

  const info = document.createElement('div');
  info.className = 'rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-700';
  info.innerHTML = `
    <p>Esta versión de código abierto contiene exclusivamente las funciones principales para cargar, analizar y exportar tus extractos bancarios. Todo el procesamiento se realiza localmente en tu navegador.</p>
    <p class="mt-2">Un agradecimiento especial a <a href="https://github.com/jcmpagel/Trade-Republic-CSV-Excel" target="_blank" rel="noopener noreferrer" class="font-semibold text-slate-900 hover:underline">jcmpagel</a> por su trabajo original, del cual se ha reutilizado parte de la lógica.</p>
  `;
  container.appendChild(info);

  return container;
}

function makeTable(title, rows) {
  if (!rows || rows.length === 0) return document.createElement('div');

  const cols = Object.keys(rows[0]).filter(k => !k.startsWith('_'));
  const wrapper = document.createElement('div');
  wrapper.className = 'overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm';

  const table = document.createElement('table');
  table.className = 'min-w-full table-auto text-left text-sm text-slate-700';
  const thead = document.createElement('thead');
  thead.className = 'bg-slate-50 text-xs uppercase tracking-wide text-slate-600';
  const headRow = document.createElement('tr');
  
  cols.forEach((k) => {
    const th = document.createElement('th');
    th.className = 'px-4 py-3 text-left font-semibold';
    th.textContent = k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ');
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  tbody.className = 'divide-y divide-slate-100';
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    const hasSanityIssue = r._sanityCheckOk === false;
    let baseRowClasses = 'odd:bg-white even:bg-slate-50 hover:bg-slate-50 transition-colors';

    // Apply color logic for P&L rows
    if (typeof r._isLoss !== 'undefined') {
        if (r._isLoss) {
            baseRowClasses += ' text-red-800 bg-red-50 hover:bg-red-100'; // Dark red for loss
        } else {
            baseRowClasses += ' text-emerald-800 bg-emerald-50 hover:bg-emerald-100'; // Dark green for profit
        }
    }

    tr.className = hasSanityIssue ? `${baseRowClasses} sanity-check-failed` : baseRowClasses;
    if (hasSanityIssue) {
      tr.title = 'Desviación de saldo detectada';
    }
    cols.forEach((k) => {
      const td = document.createElement('td');
      td.className = 'px-4 py-3 align-top break-words';
      td.textContent = r[k];
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrapper.appendChild(table);
  return wrapper;
}

function buttonBar(rows, name) {
  const bar = document.createElement('div');
  bar.className = 'flex flex-wrap items-center gap-3';
  
  const mkBtn = (txt, cb) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = txt === 'CSV' ? `${BUTTON_PRIMARY_CLASSES}` : BUTTON_BASE_CLASSES;
    b.textContent = txt;
    b.onclick = cb;
    bar.appendChild(b);
  };
  
  mkBtn('CSV', () => csvDL(rows, name));
  mkBtn('Excel', () => xlsxDL(rows, name));
  mkBtn('JSON', () => jsonDL(rows, name));
  return bar;
}
