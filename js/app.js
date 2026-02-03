/* ===================== Helpers ===================== */
const RUN_BUTTON_BASE_CLASSES = [
  'border-slate-300',
  'bg-white',
  'text-slate-700',
  'hover:border-slate-400',
  'hover:text-slate-900',
  'focus:ring-slate-300'
];

const RUN_BUTTON_SUCCESS_CLASSES = [
  'border-transparent',
  'bg-emerald-600',
  'text-white',
  'hover:bg-emerald-500',
  'focus:ring-emerald-400'
];

function applyRunButtonBase(disable = false) {
  const runBtn = $('run');
  if (!runBtn) return;
  RUN_BUTTON_SUCCESS_CLASSES.forEach(cls => runBtn.classList.remove(cls));
  RUN_BUTTON_BASE_CLASSES.forEach(cls => runBtn.classList.add(cls));
  runBtn.classList.remove('cursor-wait', 'opacity-70');
  runBtn.disabled = disable;
}

function applyRunButtonProcessing() {
  const runBtn = $('run');
  if (!runBtn) return;
  RUN_BUTTON_SUCCESS_CLASSES.forEach(cls => runBtn.classList.remove(cls));
  RUN_BUTTON_BASE_CLASSES.forEach(cls => runBtn.classList.add(cls));
  runBtn.disabled = true;
  runBtn.classList.add('cursor-wait', 'opacity-70');
}

function applyRunButtonSuccess() {
  const runBtn = $('run');
  if (!runBtn) return;
  RUN_BUTTON_BASE_CLASSES.forEach(cls => runBtn.classList.remove(cls));
  RUN_BUTTON_SUCCESS_CLASSES.forEach(cls => runBtn.classList.add(cls));
  runBtn.classList.remove('cursor-wait', 'opacity-70');
  runBtn.disabled = false;
}

function scrollToResultsSummary() {
  const summaryEl = document.getElementById('results-summary');
  if (summaryEl) {
    const header = document.querySelector('header');
    const offset = header ? header.offsetHeight + 16 : 0;
    const top = summaryEl.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }
}

/* ===================== File Handling ===================== */
const processFile = (file) => {
  if (!file) {
    applyRunButtonBase(true);
    return;
  }
  applyRunButtonBase(true);
  $("status").textContent = "Cargando PDF …";
  const reader = new FileReader();
  reader.onload = (ev) => {
    pdfjsLib.getDocument(new Uint8Array(ev.target.result)).promise
      .then((doc) => {
        pdf = doc;
        applyRunButtonBase(false);
        $("status").textContent = `${doc.numPages} páginas cargadas`;
        runAnalysis();
      })
      .catch(err => {
        $("status").textContent = "Error: " + err.message;
        applyRunButtonBase(true);
      });
  };
  reader.readAsArrayBuffer(file);
};

$("file").onchange = (e) => processFile(e.target.files[0]);

/* ===================== Main Processing Function ===================== */
async function runAnalysis() {
  if (!pdf) return;
  applyRunButtonProcessing();
  $("status").textContent = "Analizando PDF …";
  const debugEl = $("debug");
  if (debugEl) {
    debugEl.innerHTML = "";
  }

  try {
    const parseOptions = {
      updateStatus: (message) => {
        if (message) {
          $("status").textContent = message;
        }
      },
      updateProgress: (value, total) => {
        if (!total || total <= 0) return;
        const percent = Math.min(100, Math.round((value / total) * 100));
        $("status").textContent = `Procesando página ${value}/${total} (${percent}%)`;
      },
    };

    const results = await parsePDF(pdf, parseOptions);

    const { transactions: cashTransactionsWithSanity, failedChecks } = computeCashSanityChecks(results.cash || []);

    const cashDisplay = cashTransactionsWithSanity.map((t) => ({ ...t }));

    // Store globally for tax calculator access
    window.currentCashDisplay = cashDisplay;

    // Pass all relevant fields to analytics/trading
    const cashForAnalytics = cashTransactionsWithSanity.map((t) => ({
      date: t.date,
      date_iso: t.date_iso,
      type: t.type,
      description: t.description,
      incoming: t.incoming,
      incoming_amount: t.incoming_amount,
      outgoing: t.outgoing,
      outgoing_amount: t.outgoing_amount,
      balance: t.balance,
      isin: t.isin,
      name: t.name,
      quantity: t.quantity
    }));

    const interestDisplay = (results.interest || []).map((t) => ({ ...t }));
    const interestForAnalytics = interestDisplay.map((t) => ({
      date: t.date,
      paymentType: t.type,
      fund: t.description,
      quantity: t.quantity,
      pricePerUnit: t.price_per_unit,
      amount: t.amount,
    }));

    const tradingTransactions = cashForAnalytics.length ? parseTradingTransactions(cashForAnalytics) : [];
    const tradingData = tradingTransactions.length ? calculatePnL(tradingTransactions) : null;

    window.currentTradingData = tradingData;
    window.currentTradingTransactions = tradingTransactions;

    $("out").innerHTML = "";

    let chartsRendered = false;
    const chartsBundle = cashForAnalytics.length ? createCharts(cashForAnalytics, interestForAnalytics) : null;
    const chartsElement = chartsBundle ? chartsBundle.element : null;
    const chartConfigs = chartsBundle ? chartsBundle.charts : [];

    let cashTabComponent = null;
    let tradingTabComponent = null;
    let salesTabComponent = null;
    let salesByProductComponent = null; // New component
    let incomeTabComponent = null; // New component for income

    if (cashDisplay.length || interestDisplay.length || tradingTransactions.length) {
      const statsEl = document.createElement('div');
      statsEl.innerHTML = createStatsSummary(cashDisplay, interestDisplay);
      $("out").appendChild(statsEl);

      cashTabComponent = cashDisplay.length ? renderComponent('Transacciones de Efectivo', cashDisplay, 'cash', { failedChecks }) : null;

      if (cashDisplay.length > 0) {
         tradingTabComponent = renderTradingComponent(tradingData || { pnlSummary: [], totalInvested: 0, totalRealized: 0, totalNetCashFlow: 0, openPositions: 0, closedPositions: 0, totalTrades: 0, totalVolume: 0 }, tradingTransactions);

         // Calculate FIFO data for sales and income components
         if (typeof calculateTaxReport === 'function') {
           const fifoData = calculateTaxReport(window.currentCashDisplay);
           if (fifoData && fifoData.fifoJson) {
             salesTabComponent = renderSalesComponent(fifoData.fifoJson);
           }
           if (fifoData && fifoData.salesByProduct) {
             salesByProductComponent = renderSalesByProductComponent(fifoData.salesByProduct);
           }
           if (fifoData && fifoData.incomeJson) {
             incomeTabComponent = renderIncomeComponent(fifoData.incomeJson);
           }
         }
      }

      const supportComp = renderSupportComponent({
        cashCount: cashDisplay.length,
        mmfCount: interestDisplay.length,
        tradingCount: tradingTransactions.length,
        failedChecks
      });

      if (chartsElement || salesTabComponent || salesByProductComponent || incomeTabComponent || tradingTabComponent || cashTabComponent || supportComp) {
        const tabs = createTabNavigationWithTrading({
          charts: chartsElement,
          sales: salesTabComponent,
          salesByProduct: salesByProductComponent,
          income: incomeTabComponent,
          trading: tradingTabComponent,
          cash: cashTabComponent,
          support: supportComp,
          onChartsActivate: chartsBundle ? () => {
            if (!chartsRendered) {
              renderCharts(chartConfigs);
              chartsRendered = true;
            }
          } : null
        });
        if (tabs) {
          $("out").appendChild(tabs);
        }
      }
    }

    if (!cashTabComponent && chartsBundle && !chartsRendered) {
      renderCharts(chartConfigs);
      chartsRendered = true;
    }

    if (tradingData && tradingTransactions.length) {
      renderTradingCharts(tradingData, tradingTransactions);
    }

    if (!cashDisplay.length && !interestDisplay.length) {
      $("status").textContent = 'No se encontraron transacciones – por favor revisa el PDF.';
    } else if (failedChecks > 0) {
      $("status").textContent = `Listo – ${failedChecks} saldos inconsistentes detectados. Descargas disponibles, por favor verifica los datos.`;
    } else {
      $("status").textContent = 'Listo – exportación disponible. Descarga los archivos ahora.';
    }

    applyRunButtonSuccess();
    scrollToResultsSummary();
  } catch (error) {
    console.error('Error durante el procesamiento:', error);
    $("status").textContent = 'Error: ' + (error && error.message ? error.message : error);
    applyRunButtonBase(false);
  }
}

// Intentar cargar automáticamente el PDF de ejemplo (solo para pruebas locales)
async function tryLoadSamplePDF() {
  try {
    // Solo intentar en entorno local (evita peticiones cross-origin en despliegues)
    if (location.hostname !== 'localhost' && location.protocol !== 'file:') return;
    const resp = await fetch('data/Extracto de cuenta.pdf');
    if (!resp.ok) return;
    const ab = await resp.arrayBuffer();
    const doc = await pdfjsLib.getDocument(new Uint8Array(ab)).promise;
    pdf = doc;
    $("status").textContent = `${doc.numPages} páginas cargadas (ejemplo)`;
    // Ejecutar análisis automáticamente
    runAnalysis();
  } catch (e) {
    console.warn('No se pudo cargar el PDF de ejemplo automáticamente:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const runBtn = document.getElementById('run');
  if (runBtn && typeof runAnalysis === 'function') {
    runBtn.addEventListener('click', () => runAnalysis());
  }
  if (typeof feather !== 'undefined') {
    feather.replace();
  }
  // intentar cargar el PDF de ejemplo en entorno local para facilitar pruebas
  tryLoadSamplePDF();
});

// Ensure initial button styling state
applyRunButtonBase(true);
