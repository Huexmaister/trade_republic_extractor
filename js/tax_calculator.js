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

  // Determina si se debe aplicar retención (ISIN IE + fecha >= limite)
  const shouldApplyTax = (isin, dateObj) => {
    if (!isin) return false;
    return isin.startsWith("IE") && dateObj >= TAX_DATE_LIMIT;
  };

  // Determina si es Savings Plan
  const isSavingsPlan = (description) => {
    if (!description) return false;
    const desc = description.toLowerCase();
    return desc.includes("savings plan") || desc.includes("sparplan");
  };

  // Calcula comisión: 0 si es "Savings Plan", 1 en otro caso.
  const calculateCommission = (description) => {
    if (isSavingsPlan(description)) return 0.0;
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
        bruto: tx.inc, // Sin redondeo
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
        const isSavings = isSavingsPlan(tx.desc);
        // Precio Compra = (Amount - Commission) / Qty
        // Amount aquí es tx.out (lo que salió de la cuenta)
        const buyPrice = (tx.out - commission) / tx.qty;

        active.fifoQueue.push({
          date: tx.date_iso,
          qty: tx.qty,
          buyPrice: buyPrice,
          commission: commission,
          isSavings: isSavings, // Guardamos si es savings para la lógica de venta
          originalAmount: tx.out,
          commissionCharged: false
        });
      }

      // --- VENTA (Incoming > 0) ---
      else if (tx.inc > 0) {
        let qtyToSell = tx.qty;
        const commission = 1.0; // Venta ajustada a 1€ según petición explícita en fórmulas

        // Variables para acumular datos de esta venta
        let totalBuyCost = 0.0;
        const matchedBuys = [];

        // Consumir FIFO
        while (qtyToSell > 0.000001 && active.fifoQueue.length > 0) {
          const buyEntry = active.fifoQueue[0];
          const availableQty = buyEntry.qty;
          const matchedQty = Math.min(qtyToSell, availableQty);

          // Lógica solicitada: 1€ por cada matched_buy que no sea savings.
          // Solo se cobra la comisión si no se ha cobrado ya para este lote.
          let matchedCommission = 0.0;
          if (!buyEntry.isSavings && !buyEntry.commissionCharged) {
             matchedCommission = 1.0;
             buyEntry.commissionCharged = true;
          }

          // Guardar detalle del lote casado
          matchedBuys.push({
            buy_date: buyEntry.date,
            matched_qty: matchedQty,
            buy_price: buyEntry.buyPrice,
            commission: matchedCommission, // Aquí guardamos 1 o 0 según si es savings y si ya se cobró
            isSavings: buyEntry.isSavings
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

        const remainingQtyInPortfolio = active.fifoQueue.reduce((sum, batch) => sum + batch.qty, 0);

        // --- Cálculo de Beneficios e Impuestos (Nueva Lógica) ---

        // Calcular comisiones totales de compra asociadas
        const totalBuyCommissions = matchedBuys.reduce((sum, m) => sum + m.commission, 0);
        const totalCommissions = commission + totalBuyCommissions;

        // 1. Beneficio Neto (Pocket Profit) = Importe Neto (Recibido) - Coste Total de Compras (incluyendo comisiones de compra)
        // Nota: tx.inc ya tiene descontada la comisión de venta y los impuestos retenidos por el broker.
        // totalBuyCost es el coste limpio (sin comisiones).
        const netProfit = tx.inc - (totalBuyCost + totalBuyCommissions);

        let taxes = 0.0;
        let grossProfit = 0.0; // Beneficio Bruto (Ganancia Patrimonial)

        // Determinar si aplica retención
        const applyTax = shouldApplyTax(isin, tx.dateObj);

        if (applyTax) {
          // 1. Calcular Beneficio Bruto con la fórmula del usuario: (beneficio_neto / 0.81) + 1 euro
          grossProfit = (netProfit / 0.81) + 1.0;

          // 2. Calcular impuestos con la fórmula del usuario: (beneficio bruto * 0.19) - 1
          let calculatedTaxes = (grossProfit * TAX_RATE) - 1.0;
          taxes = Math.max(0, calculatedTaxes); // Asegurar que los impuestos no sean negativos
        } else {
          // No aplica retención
          // GrossProfit = NetProfit + TotalCommissions
          // Esto equivale a (SellPrice - BuyPrice) * Qty
          grossProfit = netProfit + totalCommissions;
          taxes = 0.0;
        }

        // Calcular Precio de Venta Implícito
        // Importe Bruto = Importe Neto + Impuestos + 1 (según petición)
        const sellAmountBruto = tx.inc + taxes + 1.0;
        const sellPrice = sellAmountBruto / tx.qty;

        // --- CALCULO DETALLADO POR LOTE (Para visualización perfecta) ---
        const detailedMatchedBuys = matchedBuys.map(m => {
          // Ratio de esta parte respecto al total vendido
          const ratio = m.matched_qty / tx.qty;

          // 1. Beneficio Bruto del lote
          const batchGross = (sellPrice - m.buy_price) * m.matched_qty;

          // 2. Comisiones
          // Para la tabla: solo la comisión de compra (0 o 1).
          const batchBuyCommissionForDisplay = m.commission;

          // Para el cálculo del neto del lote: comisión de compra + parte proporcional de la de venta.
          const partSellComm = commission * ratio;
          const totalCommissionsForBatchCalc = m.commission + partSellComm;

          // 3. Impuestos imputables al lote (prorrateados)
          const batchTax = taxes * ratio;

          // 4. Beneficio Neto del lote
          const batchNet = batchGross - totalCommissionsForBatchCalc - batchTax;

          return {
            buy_operation: {
              str_date: m.buy_date
            },
            matched_qty: m.matched_qty, // Sin redondeo
            buy_price: m.buy_price,     // Sin redondeo
            // Nuevos campos calculados (sin redondear para precisión interna, UI redondeará)
            batch_gross_profit: batchGross,
            batch_commissions: batchBuyCommissionForDisplay, // FIX: Usar valor discreto (0 o 1) para la UI
            batch_taxes: batchTax,
            batch_net_profit: batchNet
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
            taxes: taxes,
            bruto: sellAmountBruto,
            sell_price: sellPrice
          },
          gross_profit: grossProfit,
          net_profit: netProfit,
          total_comissions: totalCommissions,
          taxes: taxes,
          matched_buys: detailedMatchedBuys,
          remaining_qty: remainingQtyInPortfolio
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
        cantidad: totalQty, // Sin redondeo
        coste_total: totalCost, // Sin redondeo
        precio_promedio: totalCost / totalQty // Sin redondeo
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
      coste_base: costeBase,
      resultado_bruto: detail.gross_profit, // Ganancia/Pérdida bruta
      comision_estimada: detail.total_comissions,
      impuesto_estimado: detail.taxes,
      es_perdida: detail.gross_profit < 0,
      // New fields for UI
      ingresado: sellOp.amount,
      bruto: detail.gross_profit,
      impuestos: detail.taxes,
      comision: detail.total_comissions,
      neto: detail.net_profit,
      lotes: detail.matched_buys.length // Cantidad de lotes casados
    };
  });

  // D) Generar incomeJson (agrupado por año/mes)
  const incomeJson = buildNestedIncomeStructure(incomeReport);

  return {
    realized: realizedPnL,
    open: openPositions,
    income: incomeReport,
    fifoJson: allSalesDetails, // Este es el JSON detallado que quería el usuario
    incomeJson: incomeJson
  };
}

function buildNestedIncomeStructure(flatList) {
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

  return result;
}

window.calculateTaxReport = calculateTaxReport;
