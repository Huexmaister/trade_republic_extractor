/* ===================== Tax & FIFO Calculator (Core Logic) ===================== */

/**
 * Procesa las transacciones para generar:
 * 1. Reporte FIFO de Trading (Ganancias/Pérdidas realizadas).
 * 2. Posiciones Abiertas (Cartera actual calculada).
 * 3. Reporte de Ingresos (Dividendos/Intereses).
 */
function calculateTaxReport(transactions) {
  // Estructuras de datos
  const inventory = {}; // Mapa ISIN -> Array de lotes de compra [{date, qty, pricePerUnit, totalCost}]
  const realizedPnL = []; // Lista de operaciones cerradas
  const incomeReport = []; // Lista de dividendos/intereses

  // Helper de redondeo a 3 decimales
  const round3 = (num) => Math.round((num + Number.EPSILON) * 1000) / 1000;

  // 1. Preparar transacciones: Añadir índice original para estabilidad y normalizar datos
  const preparedTxs = transactions.map((tx, index) => {
    const inc = typeof tx.incoming_amount === 'number' ? tx.incoming_amount : 0;
    const out = typeof tx.outgoing_amount === 'number' ? tx.outgoing_amount : 0;
    const qty = typeof tx.quantity === 'number' ? tx.quantity : 0;

    // Determinar fecha
    let dateObj = new Date(0);
    if (tx.date_iso) {
      dateObj = new Date(tx.date_iso);
    } else if (tx.date) {
      // Intento básico de parseo si falta date_iso
      dateObj = new Date(tx.date);
    }

    return {
      ...tx,
      originalIndex: index,
      dateObj: dateObj,
      inc: inc,
      out: out,
      qty: qty,
      // Normalizar ISIN y Nombre
      isin: (tx.isin || '').trim().toUpperCase(),
      name: (tx.name || tx.description || 'Desconocido').trim()
    };
  });

  // 2. Ordenar cronológicamente
  // Criterio: Fecha ascendente -> Índice original ascendente
  preparedTxs.sort((a, b) => {
    const timeDiff = a.dateObj - b.dateObj;
    if (timeDiff !== 0) return timeDiff;
    return a.originalIndex - b.originalIndex;
  });

  // 3. Procesar FIFO
  preparedTxs.forEach(tx => {
    const type = tx.type;
    // Usar ISIN como clave principal para el inventario. Si no hay, usar nombre.
    const isinKey = tx.isin || tx.name;
    const year = tx.dateObj.getFullYear();
    const month = tx.dateObj.getMonth() + 1;

    // --- Lógica de Ingresos ---
    if (['Interés', 'Rentabilidad', 'Bonificación'].includes(type)) {
      incomeReport.push({
        fecha: tx.date_iso || tx.date,
        año: year,
        mes: month,
        tipo: type,
        descripcion: tx.description,
        bruto: round3(tx.inc),
        isin: tx.isin
      });
      return;
    }

    // --- Lógica de Trading ---
    if ((type === 'Operar' || type === 'Trade' || type === 'Handel') && tx.qty > 0) {

      if (!inventory[isinKey]) inventory[isinKey] = [];

      // DETECTAR COMPRA (Salida de dinero > 0)
      if (tx.out > 0) {
        const netCost = tx.out;
        const commission = 1.0; // Comisión fija estimada
        const grossCost = netCost - commission; // El coste de compra es el neto pagado menos la comisión

        // Añadir al inventario
        inventory[isinKey].push({
          date: tx.date_iso,
          qty: tx.qty,
          pricePerUnit: grossCost / tx.qty,
          totalCost: grossCost,
          name: tx.name
        });
      }
      // DETECTAR VENTA (Entrada de dinero > 0)
      else if (tx.inc > 0) {
        let remainingToSell = tx.qty;
        let totalCostBasis = 0;
        let acquiredDates = [];

        // Consumir del inventario (FIFO)
        while (remainingToSell > 0.000001 && inventory[isinKey].length > 0) {
          const batch = inventory[isinKey][0]; // Lote más antiguo

          const take = Math.min(batch.qty, remainingToSell);
          const costChunk = take * batch.pricePerUnit;

          totalCostBasis += costChunk;
          if (!acquiredDates.includes(batch.date)) acquiredDates.push(batch.date);

          // Actualizar lote
          batch.qty -= take;
          batch.totalCost -= costChunk;
          remainingToSell -= take;

          // Eliminar lote agotado
          if (batch.qty <= 0.000001) {
            inventory[isinKey].shift();
          }
        }

        const netProceeds = tx.inc; // Neto recibido
        const commission = 1.0; // Comisión fija estimada

        // El bruto de la venta es el neto MÁS la comisión
        const grossProceeds = netProceeds + commission;

        // Resultado Bruto = Venta Bruta - Coste Base
        const grossResult = grossProceeds - totalCostBasis;

        // Impuesto estimado (19% solo si hay ganancia)
        const taxEstimate = grossResult > 0 ? grossResult * 0.19 : 0;

        realizedPnL.push({
          año: year,
          mes: month,
          activo: tx.name,
          isin: tx.isin, // Guardamos el ISIN original de la transacción
          fecha_venta: tx.date_iso || tx.date,
          fecha_adquisicion: acquiredDates.join(', '),
          qty_vendida: round3(tx.qty),
          precio_venta_unitario: round3(grossProceeds / tx.qty),
          coste_base: round3(totalCostBasis),
          importe_venta_bruto: round3(grossProceeds),
          importe_venta_neto: round3(netProceeds),
          resultado_bruto: round3(grossResult),
          comision_estimada: commission,
          impuesto_estimado: round3(taxEstimate),
          es_perdida: grossResult < 0
        });
      }
    }
  });

  // --- Procesar Posiciones Abiertas ---
  const openPositions = [];
  Object.keys(inventory).forEach(key => {
    const batches = inventory[key];
    let totalQty = 0;
    let totalCost = 0;
    let name = '';
    let isin = '';

    batches.forEach(b => {
      totalQty += b.qty;
      totalCost += b.totalCost;
      name = b.name || name;
    });

    // Intentar recuperar ISIN de la clave si es posible, o del nombre guardado
    // Como usamos isinKey = tx.isin || tx.name, si es un ISIN lo tenemos en key
    isin = key.match(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/) ? key : '';

    if (totalQty > 0.000001) {
      openPositions.push({
        isin: isin,
        nombre: name || key,
        cantidad: round3(totalQty),
        coste_total: round3(totalCost),
        precio_promedio: round3(totalCost / totalQty)
      });
    }
  });

  return {
    realized: realizedPnL,
    open: openPositions,
    income: incomeReport,

    // Estructura anidada para JSON
    fifoJson: buildNestedFifoStructure(realizedPnL, round3),
    incomeJson: buildNestedIncomeStructure(incomeReport, round3)
  };
}

function buildNestedFifoStructure(flatList, roundFn) {
  const result = {};
  flatList.forEach(item => {
    if (!result[item.año]) result[item.año] = {};
    if (!result[item.año][item.mes]) result[item.año][item.mes] = {};

    // Clave única por activo: ISIN + Nombre para diferenciar Turbos con mismo nombre
    const key = item.isin ? `${item.isin} ${item.activo}` : item.activo;

    if (!result[item.año][item.mes][key]) {
      result[item.año][item.mes][key] = {
        fecha_venta: item.fecha_venta,
        qty_vendida: 0,
        precio_venta: 0,
        bruto: 0,
        comision: 0,
        impuestos: 0,
        neto: 0,
        coste_base: 0,
        ganancia_perdida: 0
      };
    }

    const entry = result[item.año][item.mes][key];

    entry.qty_vendida += item.qty_vendida;
    entry.bruto += item.importe_venta_bruto;
    entry.neto += item.importe_venta_neto;
    entry.comision += item.comision_estimada;
    entry.impuestos += item.impuesto_estimado;
    entry.coste_base += item.coste_base;
    entry.ganancia_perdida += item.resultado_bruto;

    // Recalcular precio medio
    if (entry.qty_vendida > 0) {
      entry.precio_venta = entry.bruto / entry.qty_vendida;
    }

    // Redondeo final
    entry.qty_vendida = roundFn(entry.qty_vendida);
    entry.bruto = roundFn(entry.bruto);
    entry.neto = roundFn(entry.neto);
    entry.comision = roundFn(entry.comision);
    entry.impuestos = roundFn(entry.impuestos);
    entry.coste_base = roundFn(entry.coste_base);
    entry.ganancia_perdida = roundFn(entry.ganancia_perdida);
    entry.precio_venta = roundFn(entry.precio_venta);
  });
  return result;
}

function buildNestedIncomeStructure(flatList, roundFn) {
  const result = {};
  flatList.forEach(item => {
    if (!result[item.año]) result[item.año] = {};
    if (!result[item.año][item.mes]) result[item.año][item.mes] = {
      'Interés': 0,
      'Rentabilidad': 0,
      'Bonificación': 0,
      'Total': 0
    };

    const monthGroup = result[item.año][item.mes];
    if (monthGroup[item.tipo] !== undefined) {
      monthGroup[item.tipo] += item.bruto;
      monthGroup['Total'] += item.bruto;
    }
  });

  // Redondeo final
  Object.keys(result).forEach(y => {
    Object.keys(result[y]).forEach(m => {
      const grp = result[y][m];
      grp['Interés'] = roundFn(grp['Interés']);
      grp['Rentabilidad'] = roundFn(grp['Rentabilidad']);
      grp['Bonificación'] = roundFn(grp['Bonificación']);
      grp['Total'] = roundFn(grp['Total']);
    });
  });

  return result;
}

window.calculateTaxReport = calculateTaxReport;
