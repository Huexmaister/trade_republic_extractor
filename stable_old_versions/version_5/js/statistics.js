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

  const container = document.createElement('div');
  container.className = 'space-y-6';

  const numericTransactions = cash.map(tx => {
    const incoming = parseEuro(tx.incoming);
    const outgoing = parseEuro(tx.outgoing);
    const balance = parseEuro(tx.balance ?? tx.saldo);
    const date = parseGermanDate(tx.date ?? tx.datum);
    return {
      raw: tx,
      date,
      dateLabel: tx.date ?? tx.datum,
      incoming,
      outgoing,
      net: incoming - outgoing,
      balance
    };
  }).filter(tx => tx.date instanceof Date && !Number.isNaN(tx.date.getTime()));

  const totalIncoming = numericTransactions.reduce((sum, tx) => sum + tx.incoming, 0);
  const totalOutgoing = numericTransactions.reduce((sum, tx) => sum + tx.outgoing, 0);
  const netChange = totalIncoming - totalOutgoing;
  const outgoingCount = numericTransactions.filter(tx => tx.outgoing > 0).length;
  const avgSpend = outgoingCount ? totalOutgoing / outgoingCount : 0;

  const dailyMap = new Map();
  numericTransactions.forEach(tx => {
    const key = tx.date.toISOString().slice(0, 10);
    if (!dailyMap.has(key)) {
      dailyMap.set(key, {
        date: tx.date,
        incoming: 0,
        outgoing: 0,
        net: 0,
        balance: tx.balance
      });
    }
    const entry = dailyMap.get(key);
    entry.incoming += tx.incoming;
    entry.outgoing += tx.outgoing;
    entry.net += tx.net;
    entry.balance = tx.balance;
  });
  const dailySeries = Array.from(dailyMap.values()).sort((a, b) => a.date - b.date);

  const typeTotals = {};
  numericTransactions.forEach(tx => {
    const type = tx.raw.type || tx.raw.typ || 'Otros';
    typeTotals[type] = typeTotals[type] || { incoming: 0, outgoing: 0 };
    typeTotals[type].incoming += tx.incoming;
    typeTotals[type].outgoing += tx.outgoing;
  });
  const typeBreakdown = Object.entries(typeTotals)
    .map(([label, totals]) => ({ label, incoming: totals.incoming, outgoing: totals.outgoing }))
    .sort((a, b) => b.outgoing - a.outgoing);

  const merchantTotals = {};
  numericTransactions.forEach(tx => {
    if (tx.outgoing <= 0) return;
    const label = tx.raw.description || tx.raw.beschreibung || 'Desconocido';
    merchantTotals[label] = (merchantTotals[label] || 0) + tx.outgoing;
  });
  const topMerchants = Object.entries(merchantTotals)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  const weekdayTotals = Array(7).fill(0);
  numericTransactions.forEach(tx => {
    if (tx.outgoing > 0) {
      weekdayTotals[tx.date.getDay()] += tx.outgoing;
    }
  });
  const weekdayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const summaryGrid = document.createElement('div');
  summaryGrid.className = 'grid gap-4 md:grid-cols-2 xl:grid-cols-4';
  summaryGrid.innerHTML = `
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Entradas</p>
      <p class="mt-2 text-2xl font-semibold text-emerald-600">${formatEuro(totalIncoming)}</p>
      <p class="mt-1 text-xs text-slate-500">Intereses, Recompensas y Reembolsos</p>
    </div>
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Salidas</p>
      <p class="mt-2 text-2xl font-semibold text-rose-600">-${formatEuro(totalOutgoing)}</p>
      <p class="mt-1 text-xs text-slate-500">Pagos con tarjeta, Planes de ahorro y Transferencias</p>
    </div>
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Cambio de Saldo</p>
      <p class="mt-2 text-2xl font-semibold ${netChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${formatEuro(netChange)}</p>
      <p class="mt-1 text-xs text-slate-500">${netChange >= 0 ? 'Neto Positivo' : 'Neto Negativo'} en el periodo</p>
    </div>
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Gasto Promedio</p>
      <p class="mt-2 text-2xl font-semibold text-slate-900">${formatEuro(avgSpend)}</p>
      <p class="mt-1 text-xs text-slate-500">Promedio por transacción con tarjeta</p>
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

  if (dailySeries.length > 1) {
    addChartCard({
      title: 'Evolución del Saldo',
      description: 'Saldos de cierre por día – muestra cómo evoluciona tu cuenta.',
      type: 'line',
      data: {
        labels: dailySeries.map(d => d.date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })),
        datasets: [{
          label: 'Saldo',
          data: dailySeries.map(d => Math.round(d.balance * 100) / 100),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          fill: true,
          tension: 0.35
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            ticks: { callback: value => formatEuro(value) }
          }
        }
      }
    });
  }

  if (dailySeries.length > 0) {
    addChartCard({
      title: 'Flujo Neto Diario',
      description: 'Comparación de ingresos y gastos diarios.',
      type: 'bar',
      data: {
        labels: dailySeries.map(d => d.date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })),
        datasets: [{
          label: 'Flujo Neto',
          data: dailySeries.map(d => Math.round(d.net * 100) / 100),
          backgroundColor: dailySeries.map(d => d.net >= 0 ? '#10b981' : '#ef4444'),
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            ticks: { callback: value => formatEuro(value) }
          }
        }
      }
    });
  }

  const spendingTypes = typeBreakdown.filter(entry => entry.outgoing > 0).slice(0, 6);
  if (spendingTypes.length > 0) {
    addChartCard({
      title: 'Gastos por Categoría',
      description: 'Muestra en qué se ha gastado más.',
      type: 'doughnut',
      data: {
        labels: spendingTypes.map(entry => entry.label),
        datasets: [{
          data: spendingTypes.map(entry => Math.round(entry.outgoing * 100) / 100),
          backgroundColor: ['#6366f1', '#ec4899', '#10b981', '#facc15', '#f97316', '#0ea5e9']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right' },
          tooltip: {
            callbacks: {
              label: context => `${context.label}: ${formatEuro(context.parsed)}`
            }
          }
        }
      }
    });
  }

  if (topMerchants.length > 0) {
    addChartCard({
      title: 'Principales Comercios',
      description: 'Los mayores bloques de gasto por comercio.',
      type: 'bar',
      data: {
        labels: topMerchants.map(entry => entry.label.length > 32 ? `${entry.label.slice(0, 29)}…` : entry.label),
        datasets: [{
          data: topMerchants.map(entry => Math.round(entry.value * 100) / 100),
          backgroundColor: '#0ea5e9',
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${formatEuro(ctx.parsed.x)}` } }
        },
        scales: {
          x: {
            ticks: { callback: value => formatEuro(value) }
          }
        }
      }
    });
  }

  if (weekdayTotals.some(value => value > 0)) {
    addChartCard({
      title: 'Gastos por Día de la Semana',
      description: '¿Qué días son más intensivos en gastos?',
      type: 'radar',
      data: {
        labels: weekdayLabels,
        datasets: [{
          label: 'Gastos',
          data: weekdayTotals.map(v => Math.round(v * 100) / 100),
          backgroundColor: 'rgba(236, 72, 153, 0.15)',
          borderColor: '#ec4899',
          pointBackgroundColor: '#ec4899',
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            ticks: { callback: value => formatEuro(value) }
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
