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

  // --- 2. Calcular Métricas Globales ---
  // Total Ganancias Histórico (Suma de resultados positivos)
  const totalGanancias = fifoData.realized
      .filter(tx => !tx.es_perdida)
      .reduce((sum, tx) => sum + tx.resultado_bruto, 0);

  // Total Pérdidas Histórico (Suma de resultados negativos, valor absoluto)
  const totalPerdidas = fifoData.realized
      .filter(tx => tx.es_perdida)
      .reduce((sum, tx) => sum + Math.abs(tx.resultado_bruto), 0);

  // Beneficio Neto (Ganancias - Pérdidas)
  const beneficioNeto = totalGanancias - totalPerdidas;

  // Promedio Mensual de Ganancias/Pérdidas
  // Agrupar por mes primero
  const monthlyNetMap = new Map();
  fifoData.realized.forEach(tx => {
      const date = new Date(tx.fecha_venta);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyNetMap.has(key)) monthlyNetMap.set(key, 0);
      monthlyNetMap.set(key, monthlyNetMap.get(key) + tx.resultado_bruto);
  });

  const monthsCount = monthlyNetMap.size || 1; // Evitar división por cero
  const totalNetResult = Array.from(monthlyNetMap.values()).reduce((a, b) => a + b, 0);
  const promedioMensual = totalNetResult / monthsCount;

  // --- 3. Renderizar Tarjetas de Resumen (KPIs) ---
  const summaryGrid = document.createElement('div');
  summaryGrid.className = 'grid gap-4 md:grid-cols-2 xl:grid-cols-4';
  summaryGrid.innerHTML = `
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Total Ganancias Histórico</p>
      <p class="mt-2 text-2xl font-semibold text-emerald-600">${formatEuro(totalGanancias)}</p>
      <p class="mt-1 text-xs text-slate-500">Suma de operaciones positivas</p>
    </div>
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Total Pérdidas Histórico</p>
      <p class="mt-2 text-2xl font-semibold text-rose-600">-${formatEuro(totalPerdidas)}</p>
      <p class="mt-1 text-xs text-slate-500">Suma de operaciones negativas</p>
    </div>
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Beneficio Neto</p>
      <p class="mt-2 text-2xl font-semibold ${beneficioNeto >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${formatEuro(beneficioNeto)}</p>
      <p class="mt-1 text-xs text-slate-500">Resultado global realizado</p>
    </div>
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Promedio Mensual</p>
      <p class="mt-2 text-2xl font-semibold ${promedioMensual >= 0 ? 'text-slate-900' : 'text-rose-600'}">${formatEuro(promedioMensual)}</p>
      <p class="mt-1 text-xs text-slate-500">Rendimiento medio por mes activo</p>
    </div>
  `;
  container.appendChild(summaryGrid);

  const chartGrid = document.createElement('div');
  chartGrid.className = 'grid gap-6 xl:grid-cols-2';
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

  // --- 4. Gráfico 1: Ganancias/Pérdidas Mensuales ---
  // Preparar datos mensuales detallados
  const monthlyDetailsMap = new Map();
  fifoData.realized.forEach(tx => {
      const date = new Date(tx.fecha_venta);
      // Clave ordenable YYYY-MM
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyDetailsMap.has(key)) {
          monthlyDetailsMap.set(key, { gain: 0, loss: 0, net: 0, label: key });
      }
      const entry = monthlyDetailsMap.get(key);

      if (tx.resultado_bruto >= 0) {
          entry.gain += tx.resultado_bruto;
      } else {
          entry.loss += Math.abs(tx.resultado_bruto); // Guardamos pérdida como positivo para sumar
      }
      entry.net += tx.resultado_bruto;
  });

  // Ordenar cronológicamente
  const sortedMonths = Array.from(monthlyDetailsMap.values()).sort((a, b) => a.label.localeCompare(b.label));

  // Formatear etiquetas para el eje X (ej. "Ene 2024")
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
                  // Guardamos datos extra para el tooltip
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
                              const netStr = formatEuro(item.net);
                              return `Neto: ${netStr}`;
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

  // --- 5. Gráfico 2: Activos más Rentables (Circular) ---
  // Agrupar beneficio por activo (ISIN o Nombre)
  const assetPerformance = {};
  fifoData.realized.forEach(tx => {
      const key = tx.activo || tx.isin || 'Desconocido';
      if (!assetPerformance[key]) assetPerformance[key] = 0;
      assetPerformance[key] += tx.resultado_bruto;
  });

  // Filtrar solo los que dieron beneficio positivo para este gráfico (o neto positivo)
  // El usuario pidió "activos que más beneficio han dado", asumiremos beneficio neto positivo acumulado.
  let assetList = Object.entries(assetPerformance)
      .filter(([_, val]) => val > 0)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

  const totalPositivePerformance = assetList.reduce((sum, item) => sum + item.value, 0);

  // Agrupar "Otros" (< 3%)
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
