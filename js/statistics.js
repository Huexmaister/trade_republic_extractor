/* ===================== Statistik-Funktionen ===================== */

const MONTH_MAP = {
  jan: 0, januar: 0,
  feb: 1, februar: 1,
  mär: 2, märz: 2, mar: 2, maerz: 2,
  apr: 3, april: 3,
  mai: 4,
  jun: 5, juni: 5,
  jul: 6, juli: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  okt: 9, oktober: 9,
  nov: 10, november: 10,
  dez: 11, dezember: 11,
  // Spanish
  ene: 0, enero: 0,
  feb: 1, febrero: 1,
  mar: 2, marzo: 2,
  abr: 3, abril: 3,
  may: 4, mayo: 4,
  jun: 5, junio: 5,
  jul: 6, julio: 6,
  ago: 7, agosto: 7,
  sep: 8, sept: 8, septiembre: 8,
  oct: 9, octubre: 9,
  nov: 10, noviembre: 10,
  dic: 11, diciembre: 11
};

let chartIdCounter = 0;

function uniqueChartId(prefix = 'chart') {
  chartIdCounter += 1;
  return `${prefix}-${Date.now()}-${chartIdCounter}`;
}

function parseEuro(value) {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'string') return 0;
  const normalized = value
    .replace(/\u00A0/g, '')
    .replace(/\s+/g, '')
    .replace(/€/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseGermanDate(value) {
  if (!value) return null;
  const parts = value.trim().split(/\s+/);
  if (parts.length < 3) return null;

  const day = parseInt(parts[0], 10);
  const monthKey = parts[1].toLowerCase().replace('.', '');
  const year = parseInt(parts[2], 10);
  const month = MONTH_MAP[monthKey];

  if (!Number.isInteger(day) || !Number.isInteger(year) || month == null) return null;
  return new Date(year, month, day);
}

function formatEuro(value) {
  return value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

/**
 * Calcula la cuota teórica del ahorro en España por tramos.
 * Base imponible del ahorro (Ganancias y Pérdidas patrimoniales compensadas).
 */
function calculateSpanishSavingsTax(base) {
  if (base <= 0) return 0;

  let tax = 0;
  let remaining = base;

  // Tramo 1: Hasta 6.000€ al 19%
  const tier1 = Math.min(remaining, 6000);
  tax += tier1 * 0.19;
  remaining -= tier1;

  // Tramo 2: Desde 6.000€ hasta 50.000€ al 21%
  if (remaining > 0) {
    const tier2 = Math.min(remaining, 44000); // 50k - 6k
    tax += tier2 * 0.21;
    remaining -= tier2;
  }

  // Tramo 3: Desde 50.000€ hasta 200.000€ al 23%
  if (remaining > 0) {
    const tier3 = Math.min(remaining, 150000); // 200k - 50k
    tax += tier3 * 0.23;
    remaining -= tier3;
  }

  // Tramo 4: Desde 200.000€ hasta 300.000€ al 27%
  if (remaining > 0) {
    const tier4 = Math.min(remaining, 100000); // 300k - 200k
    tax += tier4 * 0.27;
    remaining -= tier4;
  }

  // Tramo 5: Más de 300.000€ al 28%
  if (remaining > 0) {
    tax += remaining * 0.28;
  }

  return tax;
}

function analyzeTransactions(transactions, typKey = "type") {
  if (!transactions || transactions.length === 0) return [];
  const types = {};
  transactions.forEach(tx => {
    const type = tx[typKey] || "Otros";
    types[type] = (types[type] || 0) + 1;
  });
  return Object.entries(types)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

function analyzeCashFlow(transactions) {
  const result = { incoming: 0, outgoing: 0 };
  transactions.forEach(tx => {
    if (tx.incoming) {
      const value = parseEuro(tx.incoming);
      result.incoming += value;
    }
    if (tx.outgoing) {
      const value = parseEuro(tx.outgoing);
      result.outgoing += value;
    }
  });
  return result;
}

function createStatsSummary(cash, mmf) {
  let html = '<div id="results-summary" class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-2">';
  html += `<h3 class="text-lg font-semibold text-slate-900">Resumen de Transacciones (${cash.length + mmf.length} en total)</h3>`;
  if (cash.length > 0) {
    html += `<p class="text-sm text-slate-700"><strong class="font-semibold text-slate-900">${cash.length} Transacciones de Efectivo</strong> encontradas</p>`;
  }
  if (mmf.length > 0) {
    html += `<p class="text-sm text-slate-700"><strong class="font-semibold text-slate-900">${mmf.length} Transacciones de Fondos Monetarios</strong> encontradas</p>`;
  }
  html += '</div>';
  return html;
}

function createCharts(cash, mmf) {
  if (!cash || cash.length === 0) return null;

  // --- 1. Calcular Datos FIFO para el Portfolio ---
  let fifoData = null;
  if (typeof calculateTaxReport === 'function') {
    // Asumimos que 'cash' es la lista completa de transacciones
    fifoData = calculateTaxReport(cash);
  }

  // Si no hay datos FIFO, no podemos mostrar los gráficos solicitados
  if (!fifoData) {
      const errDiv = document.createElement('div');
      errDiv.className = 'p-4 text-red-600 bg-red-50 rounded-lg';
      errDiv.textContent = 'No se pudieron calcular los datos de Portfolio (FIFO).';
      return { element: errDiv, charts: [] };
  }

  const container = document.createElement('div');
  container.className = 'space-y-6';

  // --- 2. Agrupar Datos por Año ---
  const yearlyData = {};

  fifoData.realized.forEach(tx => {
      const date = new Date(tx.fecha_venta);
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-11

      if (!yearlyData[year]) {
          yearlyData[year] = {
              year: year,
              grossProfit: 0,
              retainedTaxes: 0, // Impuestos ya cobrados por el broker
              salesCount: 0, // Contador de ventas
              activeMonths: new Set()
          };
      }

      const yearEntry = yearlyData[year];
      yearEntry.grossProfit += tx.bruto;
      yearEntry.retainedTaxes += tx.impuestos;
      yearEntry.salesCount += 1;
      yearEntry.activeMonths.add(month);
  });

  // Ordenar años descendente (más reciente primero)
  const sortedYears = Object.keys(yearlyData).sort((a, b) => b - a);

  if (sortedYears.length === 0) {
      container.innerHTML = '<div class="text-slate-600 italic">No hay datos de ventas realizadas para mostrar estadísticas anuales.</div>';
      return { element: container, charts: [] };
  }

  // --- 3. Renderizar Tarjetas por Año ---
  const cardsGrid = document.createElement('div');
  cardsGrid.className = 'grid gap-6 md:grid-cols-2 xl:grid-cols-3';

  sortedYears.forEach(year => {
      const data = yearlyData[year];

      // Cálculos Fiscales
      // Cuota Hacienda = (Cálculo Tramos) - (Nº Ventas * 1€)
      let theoreticalTax = calculateSpanishSavingsTax(data.grossProfit);
      theoreticalTax = Math.max(0, theoreticalTax - data.salesCount); // Restar 1€ por venta, mínimo 0

      const pendingTax = theoreticalTax - data.retainedTaxes; // > 0 A pagar, < 0 A devolver
      const finalNetProfit = data.grossProfit - theoreticalTax;

      const card = document.createElement('div');
      card.className = 'flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md';

      const isGrossPositive = data.grossProfit >= 0;
      const grossColorClass = isGrossPositive ? 'text-emerald-600' : 'text-rose-600';

      // Formato para "A pagar" o "A devolver"
      let pendingTaxText = formatEuro(Math.abs(pendingTax));
      let pendingTaxLabel = "Ajuste Fiscal (0€)";
      let pendingTaxColor = "text-slate-500";

      if (pendingTax > 0.01) {
          pendingTaxLabel = "A pagar a Hacienda";
          pendingTaxColor = "text-rose-600";
          pendingTaxText = `-${formatEuro(pendingTax)}`;
      } else if (pendingTax < -0.01) {
          pendingTaxLabel = "A devolver por Hacienda";
          pendingTaxColor = "text-emerald-600";
          pendingTaxText = `+${formatEuro(Math.abs(pendingTax))}`;
      }

      card.innerHTML = `
        <div class="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <h3 class="text-xl font-bold text-slate-900">${year}</h3>
            <span class="text-xs font-medium px-2.5 py-0.5 rounded-full ${isGrossPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                ${isGrossPositive ? 'Ganancia Bruta' : 'Pérdida Bruta'}
            </span>
        </div>

        <div class="space-y-3 flex-grow">
            <div class="flex justify-between items-center">
                <span class="text-sm font-medium text-slate-700">Beneficio Bruto</span>
                <span class="text-base font-bold ${grossColorClass}">${formatEuro(data.grossProfit)}</span>
            </div>

            <div class="border-t border-slate-50 my-2"></div>

            <div class="flex justify-between items-center">
                <span class="text-sm text-slate-500">Retenido (Broker)</span>
                <span class="text-sm font-mono text-slate-600">-${formatEuro(data.retainedTaxes)}</span>
            </div>

            <div class="flex justify-between items-center">
                <span class="text-sm text-slate-500" title="Cálculo teórico tramos ahorro España - 1€/venta">Cuota Hacienda</span>
                <span class="text-sm font-mono text-slate-600">-${formatEuro(theoreticalTax)}</span>
            </div>

            <div class="flex justify-between items-center bg-slate-50 p-2 rounded-md">
                <span class="text-xs font-semibold uppercase text-slate-500">${pendingTaxLabel}</span>
                <span class="text-sm font-bold ${pendingTaxColor}">${pendingTaxText}</span>
            </div>

            <div class="pt-3 border-t border-slate-100 flex justify-between items-center">
                <span class="text-base font-bold text-slate-900">Beneficio Neto Real</span>
                <span class="text-lg font-bold ${finalNetProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
                    ${formatEuro(finalNetProfit)}
                </span>
            </div>
            <p class="text-[10px] text-center text-slate-400 mt-1">Despúes de impuestos teóricos</p>
        </div>
      `;
      cardsGrid.appendChild(card);
  });

  container.appendChild(cardsGrid);

  // --- 4. Preparar Gráficos (Barras y Circular) ---
  const chartGrid = document.createElement('div');
  chartGrid.className = 'grid gap-6 xl:grid-cols-2 mt-6'; // Added margin top
  container.appendChild(chartGrid);

  const chartConfigs = [];

  function addChartCard({ title, description, type, data, options }) {
    if (!data || !data.datasets || !data.datasets.length || !data.datasets[0].data.length) return;
    const card = document.createElement('div');
    card.className = 'flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm';
    const heading = document.createElement('div');
    heading.innerHTML = `
      <h4 class="text-base font-semibold text-slate-900">${title}</h4>
      ${description ? `<p class="text-sm text-slate-600">${description}</p>` : ''}
    `;
    const canvas = document.createElement('canvas');
    const canvasId = uniqueChartId('chart');
    canvas.id = canvasId;
    card.appendChild(heading);
    card.appendChild(canvas);
    chartGrid.appendChild(card);
    chartConfigs.push({ canvasId, type, data, options });
  }

  // --- Gráfico 1: Rendimiento Mensual (Barras) ---
  const monthlyDetailsMap = new Map();
  fifoData.realized.forEach(tx => {
      const date = new Date(tx.fecha_venta);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyDetailsMap.has(key)) {
          monthlyDetailsMap.set(key, { gain: 0, loss: 0, net: 0, label: key });
      }
      const entry = monthlyDetailsMap.get(key);

      if (tx.resultado_bruto >= 0) {
          entry.gain += tx.resultado_bruto;
      } else {
          entry.loss += Math.abs(tx.resultado_bruto);
      }
      entry.net += tx.resultado_bruto;
  });

  const sortedMonths = Array.from(monthlyDetailsMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  const monthLabels = sortedMonths.map(m => {
      const [y, mo] = m.label.split('-');
      const date = new Date(parseInt(y), parseInt(mo) - 1, 1);
      return date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
  });

  if (sortedMonths.length > 0) {
      addChartCard({
          title: 'Rendimiento Mensual',
          description: 'Evolución de ganancias y pérdidas netas por mes.',
          type: 'bar',
          data: {
              labels: monthLabels,
              datasets: [{
                  label: 'Resultado Neto',
                  data: sortedMonths.map(m => m.net),
                  backgroundColor: sortedMonths.map(m => m.net >= 0 ? '#10b981' : '#ef4444'),
                  borderRadius: 4,
                  extraData: sortedMonths
              }]
          },
          options: {
              responsive: true,
              plugins: {
                  legend: { display: false },
                  tooltip: {
                      callbacks: {
                          label: (context) => {
                              const idx = context.dataIndex;
                              const item = context.dataset.extraData[idx];
                              return `Neto: ${formatEuro(item.net)}`;
                          },
                          afterBody: (tooltipItems) => {
                              const idx = tooltipItems[0].dataIndex;
                              const item = tooltipItems[0].dataset.extraData[idx];
                              return [
                                  `Ganancias: ${formatEuro(item.gain)}`,
                                  `Pérdidas: -${formatEuro(item.loss)}`
                              ];
                          }
                      }
                  }
              },
              scales: {
                  y: {
                      ticks: { callback: value => formatEuro(value) }
                  }
              }
          }
      });
  }

  // --- Gráfico 2: Distribución de Beneficios (Circular) ---
  const assetPerformance = {};
  fifoData.realized.forEach(tx => {
      const key = tx.activo || tx.isin || 'Desconocido';
      if (!assetPerformance[key]) assetPerformance[key] = 0;
      assetPerformance[key] += tx.resultado_bruto;
  });

  let assetList = Object.entries(assetPerformance)
      .filter(([_, val]) => val > 0)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

  const totalPositivePerformance = assetList.reduce((sum, item) => sum + item.value, 0);
  const threshold = totalPositivePerformance * 0.03;
  const mainAssets = [];
  let otherValue = 0;

  assetList.forEach(item => {
      if (item.value >= threshold) {
          mainAssets.push(item);
      } else {
          otherValue += item.value;
      }
  });

  if (otherValue > 0) {
      mainAssets.push({ label: 'Otros (< 3%)', value: otherValue });
  }

  if (mainAssets.length > 0) {
      addChartCard({
          title: 'Distribución de Beneficios',
          description: 'Activos que han generado mayor rentabilidad positiva.',
          type: 'doughnut',
          data: {
              labels: mainAssets.map(a => a.label),
              datasets: [{
                  data: mainAssets.map(a => Math.round(a.value * 100) / 100),
                  backgroundColor: [
                      '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444',
                      '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16'
                  ],
                  hoverOffset: 4
              }]
          },
          options: {
              responsive: true,
              plugins: {
                  legend: { position: 'right' },
                  tooltip: {
                      callbacks: {
                          label: context => {
                              const val = context.parsed;
                              const percentage = ((val / totalPositivePerformance) * 100).toFixed(1);
                              return `${context.label}: ${formatEuro(val)} (${percentage}%)`;
                          }
                      }
                  }
              }
          }
      });
  }

  if (chartConfigs.length === 0) {
    chartGrid.remove();
  }

  return { element: container, charts: chartConfigs };
}

function renderCharts(chartConfigs) {
  if (!Array.isArray(chartConfigs) || chartConfigs.length === 0) return;
  chartConfigs.forEach(config => {
    const canvas = document.getElementById(config.canvasId);
    if (!canvas || canvas.dataset.chartInitialized === 'true') return;
    try {
      new Chart(canvas.getContext('2d'), {
        type: config.type,
        data: config.data,
        options: config.options || {}
      });
      canvas.dataset.chartInitialized = 'true';
    } catch (error) {
      console.error('Error al renderizar el gráfico:', error);
    }
  });
}
