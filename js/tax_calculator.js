/* ===================== Tax & FIFO Calculator (Core Logic) ===================== */

/**
 * Procesa las transacciones para generar:
 * 1. Reporte FIFO de Trading (Ganancias/Pérdidas realizadas) con lógica idéntica a Python.
 * 2. Posiciones Abiertas (Cartera actual calculada).
 * 3. Reporte de Ingresos (Dividendos/Intereses).
 */
function calculateTaxReport(transactions) {
  // --- Helpers y Constantes ---
  const TAX_RATE = 0.19;
  const TAX_DATE_LIMIT = new Date("2025-07-01");

  const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;
  const round4 = (num) => Math.round((num + Number.EPSILON) * 10000) / 10000;

  // Determina si se debe aplicar retención (ISIN IE + fecha >= limite)
  const shouldApplyTax = (isin, dateObj) => {
    if (!isin) return false;
    return isin.startsWith("IE") && dateObj >= TAX_DATE_LIMIT;
  };

  // Calcula comisión: 0 si es "Savings" (Plan de Inversión), 1 en otro caso
  const calculateCommission = (description) => {
    if (description && description.includes("Savings")) return 0.0;
    return 1.0;
  };

  // --- Estructuras de Estado ---
  // Mapa ISIN -> Objeto Activo { isin, name, fifoQueue: [], closedOps: [], openOps: [], salesDetails: [] }
  const actives = {};
  const incomeReport = [];
  const allSalesDetails = []; // Lista global plana para exportación

  // 1. Preparar y Ordenar Transacciones
  const preparedTxs = transactions.map((tx, index) => {
    let dateObj = new Date(0);
    if (tx.date_iso) dateObj = new Date(tx.date_iso);
    else if (tx.date) dateObj = new Date(tx.date);

    return {
      ...tx,
      originalIndex: index,
      dateObj: dateObj,
      inc: typeof tx.incoming_amount === 'number' ? tx.incoming_amount : 0,
      out: typeof tx.outgoing_amount === 'number' ? tx.outgoing_amount : 0,
      qty: typeof tx.quantity === 'number' ? tx.quantity : 0,
      isin: (tx.isin || '').trim().toUpperCase(),
      name: (tx.name || tx.description || 'Desconocido').trim(),
      desc: tx.description || ''
    };
  });

  // Ordenar: Fecha ascendente -> Índice original ascendente
  preparedTxs.sort((a, b) => {
    const timeDiff = a.dateObj - b.dateObj;
    if (timeDiff !== 0) return timeDiff;
    return a.originalIndex - b.originalIndex;
  });

  // 2. Procesar Transacciones
  preparedTxs.forEach(tx => {
    const type = tx.type;
    const isin = tx.isin;
    const name = tx.name;

    // --- Ingresos (Dividendos, Intereses) ---
    if (['Interés', 'Rentabilidad', 'Bonificación'].includes(type)) {
      let incomeType = type;
      if (type === 'Rentabilidad') incomeType = 'Dividendos';
      if (type === 'Bonificación') incomeType = 'Saveback';

      incomeReport.push({
        fecha: tx.date_iso || tx.date,
        año: tx.dateObj.getFullYear(),
        mes: tx.dateObj.getMonth() + 1,
        tipo: incomeType,
        descripcion: tx.desc,
        bruto: round2(tx.inc),
        isin: isin
      });
      return;
    }

    // --- Trading (Operar, Trade, Handel) ---
    if ((type === 'Operar' || type === 'Trade' || type === 'Handel') && tx.qty > 0) {
      // Inicializar activo si no existe
      if (!actives[isin]) {
        actives[isin] = {
          isin: isin,
          name: name,
          fifoQueue: [], // Array de { date, qty, buyPrice, totalCost, commission }
          salesDetails: []
        };
      }
      const active = actives[isin];

      // --- COMPRA (Outgoing > 0) ---
      if (tx.out > 0) {
        const commission = calculateCommission(tx.desc);
        // Precio Compra = (Amount - Commission) / Qty
        // Amount aquí es tx.out (lo que salió de la cuenta)
        const buyPrice = (tx.out - commission) / tx.qty;

        active.fifoQueue.push({
          date: tx.date_iso,
          qty: tx.qty,
          buyPrice: buyPrice,
          commission: commission,
          originalAmount: tx.out,
          commissionCharged: false // Flag to track if commission has been charged
        });
      }

      // --- VENTA (Incoming > 0) ---
      else if (tx.inc > 0) {
        let qtyToSell = tx.qty;
        const commission = 1.0; // Venta siempre 1€ (según lógica Python)

        // Variables para acumular datos de esta venta
        let currentSaleGrossProfit = 0.0;
        let totalBuyCost = 0.0;
        const matchedBuys = [];

        // Consumir FIFO
        while (qtyToSell > 0.000001 && active.fifoQueue.length > 0) {
          const buyEntry = active.fifoQueue[0];
          const availableQty = buyEntry.qty;
          const matchedQty = Math.min(qtyToSell, availableQty);

          // Calculate commission for this match (User logic: full commission on first touch)
          let matchedCommission = 0;
          if (!buyEntry.commissionCharged && buyEntry.commission > 0) {
             matchedCommission = buyEntry.commission;
             buyEntry.commissionCharged = true;
          }

          // Guardar detalle del lote casado
          matchedBuys.push({
            buy_date: buyEntry.date,
            matched_qty: matchedQty,
            buy_price: buyEntry.buyPrice,
            commission: matchedCommission
          });

          // Acumular coste de compra de la parte casada
          totalBuyCost += matchedQty * buyEntry.buyPrice;

          // Actualizar cantidades
          qtyToSell -= matchedQty;
          buyEntry.qty -= matchedQty;

          // Si se agota el lote, sacarlo
          if (buyEntry.qty <= 0.000001) {
            active.fifoQueue.shift();
          }
        }

        // --- Cálculo de Impuestos Inverso (Lógica Python) ---
        let taxes = 0.0;
        let bruto = 0.0;
        let sellPrice = 0.0;

        // Determinar si aplica retención
        const applyTax = shouldApplyTax(isin, tx.dateObj);

        if (applyTax) {
          // VentaBruta = (Incoming + Comision - 0.19 * CosteCompra) / 0.81
          const incoming = tx.inc;
          const vHypothetical = (incoming + commission - (TAX_RATE * totalBuyCost)) / (1 - TAX_RATE);

          if (vHypothetical > totalBuyCost) {
            // Ganancia -> Retención
            bruto = vHypothetical;
            taxes = (bruto - totalBuyCost) * TAX_RATE;
          } else {
            // Pérdida -> No retención
            bruto = incoming + commission;
            taxes = 0.0;
          }
        } else {
          // No aplica retención
          bruto = tx.inc + commission;
          taxes = 0.0;
        }

        sellPrice = bruto / tx.qty;

        // Calcular Beneficios
        // Gross Profit = (Precio Venta - Precio Compra) * Cantidad Casada
        // Lo calculamos sumando los tramos
        matchedBuys.forEach(match => {
          const profit = (sellPrice - match.buy_price) * match.matched_qty;
          currentSaleGrossProfit += profit;
        });

        // Sum of buy commissions (excluding savings plans which are 0 anyway)
        const totalBuyCommissions = matchedBuys.reduce((sum, m) => sum + m.commission, 0);
        const totalCommissions = commission + totalBuyCommissions;

        const netProfit = currentSaleGrossProfit - totalCommissions - taxes;

        // --- CALCULO DETALLADO POR LOTE (Para visualización perfecta) ---
        const detailedMatchedBuys = matchedBuys.map(m => {
          // Ratio de esta parte respecto al total vendido
          const ratio = m.matched_qty / tx.qty;

          // 1. Beneficio Bruto del lote
          const batchGross = (sellPrice - m.buy_price) * m.matched_qty;

          // 2. Comisiones imputables al lote
          // = Comisión de compra específica de este lote + Parte proporcional de la comisión de venta
          const partSellComm = commission * ratio;
          const batchComm = m.commission + partSellComm;

          // 3. Impuestos imputables al lote (prorrateados)
          const batchTax = taxes * ratio;

          // 4. Beneficio Neto del lote
          const batchNet = batchGross - batchComm - batchTax;

          return {
            buy_operation: {
              str_date: m.buy_date
            },
            matched_qty: round4(m.matched_qty),
            buy_price: round4(m.buy_price),
            // Nuevos campos calculados
            batch_gross_profit: round2(batchGross),
            batch_commissions: round2(batchComm),
            batch_taxes: round2(batchTax),
            batch_net_profit: round2(batchNet)
          };
        });

        // Construir objeto de detalle de venta
        const saleDetail = {
          active_name: name,
          active_isin: isin,
          sell_date: tx.date_iso,
          sell_operation: {
            type: "SellOperation",
            isin: isin,
            str_date: tx.date_iso,
            description: tx.desc,
            qty: tx.qty,
            amount: tx.inc,
            comissions: commission,
            taxes: round2(taxes),
            bruto: round2(bruto),
            sell_price: round4(sellPrice)
          },
          gross_profit: round2(currentSaleGrossProfit),
          net_profit: round2(netProfit),
          comissions: round2(totalCommissions),
          taxes: round2(taxes),
          matched_buys: detailedMatchedBuys
        };

        active.salesDetails.push(saleDetail);
        allSalesDetails.push(saleDetail);
      }
    }
  });

  // 3. Generar Reportes Finales

  // A) Ordenar ventas históricas por fecha descendente
  allSalesDetails.sort((a, b) => {
    const dateA = new Date(a.sell_date);
    const dateB = new Date(b.sell_date);
    return dateB - dateA;
  });

  // B) Generar lista de posiciones abiertas
  const openPositions = [];
  Object.values(actives).forEach(active => {
    let totalQty = 0;
    let totalCost = 0; // Valor actual basado en precio de compra remanente

    active.fifoQueue.forEach(batch => {
      totalQty += batch.qty;
      // Coste del lote remanente = qty * buyPrice
      totalCost += batch.qty * batch.buyPrice;
    });

    if (totalQty > 0.000001) {
      openPositions.push({
        isin: active.isin,
        nombre: active.name,
        cantidad: round4(totalQty),
        coste_total: round2(totalCost),
        precio_promedio: round4(totalCost / totalQty)
      });
    }
  });

  // C) Generar lista "realized" para la tabla UI (formato plano simplificado)
  const realizedPnL = allSalesDetails.map(detail => {
    const sellOp = detail.sell_operation;
    // Coste base = Bruto - GrossProfit
    const costeBase = sellOp.bruto - detail.gross_profit;

    return {
      fecha_venta: sellOp.str_date,
      activo: detail.active_name,
      isin: detail.active_isin,
      qty_vendida: sellOp.qty,
      importe_venta_neto: sellOp.amount, // Lo que llegó al banco
      importe_venta_bruto: sellOp.bruto,
      coste_base: round2(costeBase),
      resultado_bruto: detail.gross_profit, // Ganancia/Pérdida bruta
      comision_estimada: detail.comissions,
      impuesto_estimado: detail.taxes,
      es_perdida: detail.gross_profit < 0,
      // New fields for UI
      ingresado: sellOp.amount,
      bruto: detail.gross_profit,
      impuestos: detail.taxes,
      comision: detail.comissions,
      neto: detail.net_profit,
      lotes: detail.matched_buys.length // Cantidad de lotes casados
    };
  });

  // D) Generar incomeJson (agrupado por año/mes)
  const incomeJson = buildNestedIncomeStructure(incomeReport, round2);

  return {
    realized: realizedPnL,
    open: openPositions,
    income: incomeReport,
    fifoJson: allSalesDetails, // Este es el JSON detallado que quería el usuario
    incomeJson: incomeJson
  };
}

function buildNestedIncomeStructure(flatList, roundFn) {
  const result = {};
  flatList.forEach(item => {
    if (!result[item.año]) result[item.año] = {};
    if (!result[item.año][item.mes]) result[item.año][item.mes] = {
      'Interés': 0,
      'Dividendos': 0,
      'Saveback': 0,
      'Total': 0
    };

    const monthGroup = result[item.año][item.mes];

    // Map old types to new keys
    let key = item.tipo;
    if (key === 'Rentabilidad') key = 'Dividendos';
    if (key === 'Bonificación') key = 'Saveback';

    if (monthGroup[key] !== undefined) {
      monthGroup[key] += item.bruto;
      monthGroup['Total'] += item.bruto;
    }
  });

  // Redondeo final
  Object.keys(result).forEach(y => {
    Object.keys(result[y]).forEach(m => {
      const grp = result[y][m];
      grp['Interés'] = roundFn(grp['Interés']);
      grp['Dividendos'] = roundFn(grp['Dividendos']);
      grp['Saveback'] = roundFn(grp['Saveback']);
      grp['Total'] = roundFn(grp['Total']);
    });
  });

  return result;
}

window.calculateTaxReport = calculateTaxReport;
