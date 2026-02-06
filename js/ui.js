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

function createTabNavigationWithTrading(config) {
  const {
    cash,
    charts,
    sales,
    salesByProduct, // New component
    income, // New income component
    trading,
    support,
    onChartsActivate
  } = config;

  // New tab order
  const tabDefinitions = [
    { id: 'charts', label: 'Gráficos', content: charts, onActivate: onChartsActivate },
    { id: 'sales', label: 'Desglose de Ventas', content: sales },
    { id: 'salesByProduct', label: 'Desglose por Producto', content: salesByProduct },
    { id: 'income', label: 'Ingresos (Dividendos/Intereses)', content: income },
    { id: 'trading', label: 'Trading P&L (Beta)', content: trading },
    { id: 'cash', label: 'Transacciones de Efectivo', content: cash },
    { id: 'support', label: 'Resumen de Resultados', content: support }
  ].filter(def => def && def.content);

  if (tabDefinitions.length === 0) return null;

  const container = document.createElement('div');
  container.className = 'mt-10 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm';
  container.dataset.tabContainer = 'true';

  const tabs = document.createElement('div');
  tabs.className = 'flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 px-4 pt-4';
  container.appendChild(tabs);

  const components = [];

  const registerTab = ({ id, label, content, onActivate }) => {
    // Set "Gráficos" as the default active tab
    const isActive = id === 'charts';
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.textContent = label;
    tab.dataset.tabRole = 'navigation';
    tab.dataset.tabLabel = label;
    applyTabStyles(tab, isActive);
    tabs.appendChild(tab);

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('space-y-6');
    applyTabContentStyles(contentDiv, isActive);
    contentDiv.dataset.tabRole = 'panel';
    contentDiv.dataset.tabLabel = label;
    contentDiv.appendChild(content);
    container.appendChild(contentDiv);

    const entry = { tab, contentDiv, onActivate, activated: false };
    components.push(entry);

    if (isActive && onActivate && !entry.activated) {
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

function renderSalesByProductComponent(salesByProductData) {
  const container = document.createElement('div');
  container.className = 'space-y-4';

  if (!salesByProductData || salesByProductData.length === 0) {
    container.innerHTML = '<div class="text-slate-600 italic">No hay ventas registradas para mostrar el desglose por producto.</div>';
    return container;
  }

  salesByProductData.forEach(product => {
    const details = document.createElement('details');
    details.className = 'group rounded-lg border border-slate-200 bg-white shadow-sm open:ring-1 open:ring-slate-200 transition-all';

    const summary = document.createElement('summary');
    summary.className = 'flex cursor-pointer items-center justify-between p-4 font-medium text-slate-900 hover:bg-slate-50 focus:outline-none select-none';

    const isProfit = product.total_net_profit >= 0;
    const profitClass = isProfit ? 'text-emerald-600' : 'text-red-600';
    const profitSign = isProfit ? '+' : '';

    summary.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 overflow-hidden">
        <span class="font-semibold truncate" title="${product.name}">${product.name}</span>
        <span class="text-xs text-slate-500 font-normal shrink-0">${product.isin}</span>
        <span class="text-xs text-slate-400 font-normal shrink-0">(${product.sales.length} ventas)</span>
      </div>
      <div class="flex items-center gap-4 shrink-0 ml-2">
        <div class="flex flex-col items-end text-xs sm:text-sm">
           <span class="text-slate-500">Impuestos: <span class="text-red-500">-${product.total_taxes.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></span>
           <span class="${profitClass} font-bold whitespace-nowrap">Neto: ${profitSign}${product.total_net_profit.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
        </div>
        <i data-feather="chevron-down" class="h-4 w-4 text-slate-400 transition-transform duration-200 group-open:rotate-180"></i>
      </div>
    `;

    const content = document.createElement('div');
    content.className = 'border-t border-slate-100 p-4 text-sm text-slate-700 space-y-4';

    // Render individual sales for this product using the existing logic
    const salesContainer = renderSalesComponent(product.sales);
    // Remove the outer container styling from renderSalesComponent to fit nicely inside
    salesContainer.className = 'space-y-4 pl-2 border-l-2 border-slate-100';

    content.appendChild(salesContainer);
    details.appendChild(summary);
    details.appendChild(content);
    container.appendChild(details);
  });

  return container;
}

function renderSalesComponent(salesData) {
  const container = document.createElement('div');
  container.className = 'space-y-4';

  if (!salesData || salesData.length === 0) {
    container.innerHTML = '<div class="text-slate-600 italic">No hay ventas registradas para mostrar el desglose.</div>';
    return container;
  }

  salesData.forEach(sale => {
    const details = document.createElement('details');
    details.className = 'group rounded-lg border border-slate-200 bg-white shadow-sm open:ring-1 open:ring-slate-200 transition-all';

    const summary = document.createElement('summary');
    summary.className = 'flex cursor-pointer items-center justify-between p-4 font-medium text-slate-900 hover:bg-slate-50 focus:outline-none select-none';

    const isProfit = sale.net_profit >= 0;
    const profitClass = isProfit ? 'text-emerald-600' : 'text-red-600';
    const profitSign = isProfit ? '+' : '';

    summary.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 overflow-hidden">
        <span class="font-semibold truncate" title="${sale.active_name}">${sale.active_name}</span>
        <span class="text-xs text-slate-500 font-normal shrink-0">${sale.active_isin}</span>
      </div>
      <div class="flex items-center gap-4 shrink-0 ml-2">
        <span class="text-sm text-slate-600 hidden sm:inline">${sale.sell_date}</span>
        <span class="${profitClass} font-bold whitespace-nowrap">${profitSign}${sale.net_profit.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
        <i data-feather="chevron-down" class="h-4 w-4 text-slate-400 transition-transform duration-200 group-open:rotate-180"></i>
      </div>
    `;

    const content = document.createElement('div');
    content.className = 'border-t border-slate-100 p-4 text-sm text-slate-700';

    content.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-2">
          <h4 class="font-semibold text-slate-900 border-b border-slate-100 pb-1">Operación de Venta</h4>
          <div class="grid grid-cols-2 gap-y-1 text-xs sm:text-sm">
            <span class="text-slate-500">Cantidad Vendida:</span>
            <span class="text-right font-mono">${sale.sell_operation.qty.toLocaleString('es-ES', { maximumFractionDigits: 6 })}</span>

            <span class="text-slate-500">Quedan en cartera:</span>
            <span class="text-right font-mono">${(sale.remaining_qty || 0).toLocaleString('es-ES', { maximumFractionDigits: 6 })}</span>

            <span class="text-slate-500">Precio Venta:</span>
            <span class="text-right font-mono">${sale.sell_operation.sell_price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}</span>

            <span class="text-slate-500">Importe Bruto:</span>
            <span class="text-right font-mono">${sale.sell_operation.bruto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>

            <span class="text-slate-500">Importe Neto (Recibido):</span>
            <span class="text-right font-mono font-medium text-slate-900">${sale.sell_operation.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
          </div>
        </div>

        <div class="space-y-2">
          <h4 class="font-semibold text-slate-900 border-b border-slate-100 pb-1">Resultado</h4>
          <div class="grid grid-cols-2 gap-y-1 text-xs sm:text-sm">
            <span class="text-slate-500">Beneficio Bruto:</span>
            <span class="text-right font-mono">${sale.gross_profit.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>

            <span class="text-slate-500">Comisiones Totales:</span>
            <span class="text-right font-mono text-red-500">-${sale.total_comissions.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>

            <span class="text-slate-500">Impuestos:</span>
            <span class="text-right font-mono text-red-500">-${sale.taxes.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>

            <span class="text-slate-500 font-semibold">Beneficio Neto:</span>
            <span class="text-right font-mono font-bold ${profitClass}">${profitSign}${sale.net_profit.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
          </div>
        </div>
      </div>

      <div class="mt-6">
        <h4 class="font-semibold text-slate-900 border-b border-slate-100 pb-2 mb-2">Lotes de Compra Asignados (FIFO)</h4>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="text-slate-500 font-medium bg-slate-50">
              <tr>
                <th class="px-2 py-1 rounded-l">Fecha Compra</th>
                <th class="px-2 py-1 text-right">Cantidad</th>
                <th class="px-2 py-1 text-right">Precio Compra</th>
                <th class="px-2 py-1 text-right">Coste Total</th>
                <th class="px-2 py-1 text-right">B. Bruto</th>
                <th class="px-2 py-1 text-right">Impuestos</th>
                <th class="px-2 py-1 text-right">Comisiones</th>
                <th class="px-2 py-1 text-right rounded-r">B. Neto</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              ${sale.matched_buys.map(buy => {
                const isBatchProfit = buy.batch_net_profit >= 0;
                const batchProfitClass = isBatchProfit ? 'text-emerald-600' : 'text-red-600';

                return `
                <tr>
                  <td class="px-2 py-1">${buy.buy_operation.str_date}</td>
                  <td class="px-2 py-1 text-right font-mono">${buy.matched_qty.toLocaleString('es-ES', { maximumFractionDigits: 6 })}</td>
                  <td class="px-2 py-1 text-right font-mono">${buy.buy_price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 4 })}</td>
                  <td class="px-2 py-1 text-right font-mono">${(buy.matched_qty * buy.buy_price).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                  <td class="px-2 py-1 text-right font-mono">${buy.batch_gross_profit.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                  <td class="px-2 py-1 text-right font-mono text-red-500">-${buy.batch_taxes.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                  <td class="px-2 py-1 text-right font-mono text-red-500">-${buy.batch_commissions.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                  <td class="px-2 py-1 text-right font-mono font-semibold ${batchProfitClass}">${buy.batch_net_profit.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                </tr>
              `}).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    details.appendChild(summary);
    details.appendChild(content);
    container.appendChild(details);
  });

  return container;
}

// New component for rendering income by month
function renderIncomeComponent(incomeData) {
  const container = document.createElement('div');
  container.className = 'space-y-4';

  if (!incomeData || Object.keys(incomeData).length === 0) {
    container.innerHTML = '<div class="text-slate-600 italic">No hay ingresos (dividendos, intereses) registrados.</div>';
    return container;
  }

  // Sort years and months descending
  const sortedYears = Object.keys(incomeData).sort((a, b) => b - a);

  sortedYears.forEach(year => {
    const sortedMonths = Object.keys(incomeData[year]).sort((a, b) => b - a);

    sortedMonths.forEach(month => {
      const monthData = incomeData[year][month];
      const monthLabel = `${year}-${String(month).padStart(2, '0')}`;

      const details = document.createElement('details');
      details.className = 'group rounded-lg border border-slate-200 bg-white shadow-sm open:ring-1 open:ring-slate-200 transition-all';

      const summary = document.createElement('summary');
      summary.className = 'flex cursor-pointer items-center justify-between p-4 font-medium text-slate-900 hover:bg-slate-50 focus:outline-none select-none';

      summary.innerHTML = `
        <div class="flex items-center gap-4">
          <span class="font-semibold">${monthLabel}</span>
        </div>
        <div class="flex items-center gap-4">
          <span class="font-bold text-emerald-600 whitespace-nowrap">+${monthData.Total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
          <i data-feather="chevron-down" class="h-4 w-4 text-slate-400 transition-transform duration-200 group-open:rotate-180"></i>
        </div>
      `;

      const content = document.createElement('div');
      content.className = 'border-t border-slate-100 p-4 text-sm text-slate-700';

      const incomeRows = [
        { label: 'Dividendos', value: monthData.Dividendos, icon: 'dollar-sign' },
        { label: 'Intereses', value: monthData.Interés, icon: 'percent' },
        { label: 'Saveback', value: monthData.Saveback, icon: 'gift' }
      ].filter(row => row.value > 0);

      content.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${incomeRows.map(row => `
            <div class="flex items-center justify-between rounded-md bg-slate-50 p-3">
              <span class="flex items-center gap-2 text-slate-600">
                <i data-feather="${row.icon}" class="h-4 w-4"></i>
                ${row.label}
              </span>
              <span class="font-mono font-medium text-slate-900">${row.value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
            </div>
          `).join('')}
        </div>
      `;

      details.appendChild(summary);
      details.appendChild(content);
      container.appendChild(details);
    });
  });

  return container;
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
        ingresado: tx.ingresado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }),
        'beneficio bruto': tx.bruto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }),
        impuestos: tx.impuestos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }),
        comision: tx.comision.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }),
        'beneficio neto': tx.neto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }),
        lotes: tx.lotes,
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

  // Add "Guardar y Recalcular" button for Cash Transactions
  if (prefix === 'cash') {
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = BUTTON_PRIMARY_CLASSES;
      saveBtn.innerHTML = '<i data-feather="save" class="mr-2"></i> Guardar y Recalcular';
      saveBtn.onclick = () => {
          if (typeof window.triggerRecalculation === 'function') {
              window.triggerRecalculation();
          } else {
              alert('Función de recálculo no disponible.');
          }
      };
      bar.appendChild(saveBtn);
  }

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
              _sanityCheckOk: r._sanityCheckOk, // Preserve sanity check flag
              _originalRow: r // Keep reference to original row for editing
          }));
  }

  // Add table
  container.appendChild(makeTable(title, displayRows, prefix === 'cash'));
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

function makeTable(title, rows, editable = false) {
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

      if (editable && k === 'date_iso') {
          const input = document.createElement('input');
          input.type = 'text';
          input.value = r[k];
          input.className = 'w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-500 focus:outline-none px-1';
          input.onchange = (e) => {
              // Update the original row in the global data
              if (r._originalRow) {
                  r._originalRow.date_iso = e.target.value;
                  // Also update the local display row to keep consistency
                  r.date_iso = e.target.value;
              }
          };
          td.appendChild(input);
      } else {
          td.textContent = r[k];
      }

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
