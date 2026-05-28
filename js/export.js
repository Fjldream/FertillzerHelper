/**
 * export.js — Excel 报告导出功能
 * 使用 SheetJS 库生成专业的 Excel 报告
 */

/** 导出含量计算报告为 Excel */
function exportFormulaToExcel() {
  // 使用缓存的求解结果
  const cached = AppState.lastFormulaResult;
  if (!cached) {
    alert('请先完成配方求解');
    return;
  }

  const { allRaws, allPcts, totalKg, targetN, targetP, targetK, minNPK } = cached;

  // 计算养分
  const actualN = allPcts.reduce((s, p, i) => s + p * allRaws[i].n, 0);
  const actualP = allPcts.reduce((s, p, i) => s + p * allRaws[i].p, 0);
  const actualK = allPcts.reduce((s, p, i) => s + p * allRaws[i].k, 0);
  const actualCl = allPcts.reduce((s, p, i) => s + p * allRaws[i].cl, 0);
  const actualNPK = actualN + actualP + actualK;
  const cost = allPcts.reduce((s, p, i) => s + p * allRaws[i].price, 0);

  // 计算微量元素
  const traceResults = calculateAllTraceElements(allRaws, allPcts);

  // 生成 Excel
  generateExcelReport({
    type: '含量计算',
    targetN, targetP, targetK, totalKg, minNPK,
    actualN, actualP, actualK, actualCl, actualNPK,
    cost,
    allRaws, allPcts,
    traceResults
  });
}

/** 导出核价计算报告为 Excel */
function exportPricingToExcel() {
  const rows = pricingRows.map((row, i) => {
    const sel = document.getElementById('pr' + i + '_sel');
    const name = sel ? sel.value : row.name;
    const raw = getRaw(name) || { n: 0, p: 0, k: 0, price: 0, trace: {} };
    let pct;
    if (row.fixed) {
      const inp = document.getElementById('pr' + i + '_pct');
      pct = (inp ? +inp.value : row.pct) / 100;
    } else {
      pct = row.pct / 100;
    }
    return { raw, pct, name, fixed: row.fixed };
  });

  const totalKg = +document.getElementById('p_total').value || 1000;
  const targetN = +document.getElementById('p_targetN').value;
  const targetP = +document.getElementById('p_targetP').value;
  const targetK = +document.getElementById('p_targetK').value;

  const allRaws = rows.map(r => r.raw);
  const allPcts = rows.map(r => r.pct);

  const actualN = allPcts.reduce((s, p, i) => s + p * allRaws[i].n, 0);
  const actualP = allPcts.reduce((s, p, i) => s + p * allRaws[i].p, 0);
  const actualK = allPcts.reduce((s, p, i) => s + p * allRaws[i].k, 0);
  const actualCl = allPcts.reduce((s, p, i) => s + p * allRaws[i].cl, 0);
  const actualNPK = actualN + actualP + actualK;
  const cost = allPcts.reduce((s, p, i) => s + p * allRaws[i].price, 0);

  const traceResults = calculateAllTraceElements(allRaws, allPcts);

  generateExcelReport({
    type: '核价计算',
    targetN, targetP, targetK, totalKg,
    actualN, actualP, actualK, actualCl, actualNPK,
    cost,
    extraCost: getTotalExtraCost(),
    totalProductionCost: cost + getTotalExtraCost(),
    allRaws, allPcts,
    traceResults,
    fixedInfo: rows.map(r => r.fixed)
  });
}

/** 计算所有微量元素 */
function calculateAllTraceElements(allRaws, allPcts) {
  const traceResults = {};
  const allTraceSymbols = new Set();

  allRaws.forEach(raw => {
    if (raw.trace) {
      Object.keys(raw.trace).forEach(sym => allTraceSymbols.add(sym));
    }
  });

  allTraceSymbols.forEach(symbol => {
    const total = allPcts.reduce((sum, pct, i) => {
      const raw = allRaws[i];
      return sum + pct * (raw.trace?.[symbol] || 0);
    }, 0);

    if (total > 0.001) {
      const commonEl = COMMON_TRACE_ELEMENTS.find(el => el.symbol === symbol);
      traceResults[symbol] = {
        name: commonEl ? commonEl.name : symbol,
        value: total
      };
    }
  });

  return traceResults;
}

/** 生成 Excel 报告 */
function generateExcelReport(data) {
  const wb = XLSX.utils.book_new();
  const timestamp = new Date().toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).replace(/\//g, '-');

  // ===== Sheet 1: 配方概览 =====
  const overviewData = [
    ['水溶肥配方计算系统 - ' + data.type + '报告'],
    ['生成时间', timestamp],
    [],
    ['目标配方设置'],
    ['目标氮 N (%)', data.targetN],
    ['目标磷 P (%)', data.targetP],
    ['目标钾 K (%)', data.targetK],
    ['总重量 (kg)', data.totalKg],
  ];

  if (data.minNPK !== undefined) {
    overviewData.push(['总养分下限 (%)', data.minNPK]);
  }

  overviewData.push(
    [],
    ['实际养分分析'],
    ['实际氮 N (%)', parseFloat(data.actualN.toFixed(2))],
    ['实际磷 P (%)', parseFloat(data.actualP.toFixed(2))],
    ['实际钾 K (%)', parseFloat(data.actualK.toFixed(2))],
    ['实际氯 Cl (%)', parseFloat(data.actualCl.toFixed(2))],
    ['总养分 NPK (%)', parseFloat(data.actualNPK.toFixed(2))],
    [],
    ['成本信息'],
    ['裸料成本 (元/吨)', parseFloat(data.cost.toFixed(2))],
  );

  if (data.extraCost !== undefined) {
    overviewData.push(
      ['附加成本 (元/吨)', parseFloat(data.extraCost.toFixed(2))],
      ['生产总成本 (元/吨)', parseFloat(data.totalProductionCost.toFixed(2))]
    );
  }

  overviewData.push(
    ['总质量 (kg)', parseFloat((data.allPcts.reduce((s, p) => s + p, 0) * data.totalKg).toFixed(2))]
  );

  const ws1 = XLSX.utils.aoa_to_sheet(overviewData);
  ws1['!cols'] = [{ wch: 20 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws1, '配方概览');

  // ===== Sheet 2: 原料明细 =====
  const materialHeader = ['原料名称', '百分比 (%)', '用量 (kg)', '价格 (元/吨)', '分摊成本 (元)',
                          '贡献氮 (%)', '贡献磷 (%)', '贡献钾 (%)', '贡献氯 (%)'];

  if (data.fixedInfo) {
    materialHeader.push('类型');
  }

  const materialData = [materialHeader];

  data.allRaws.forEach((raw, i) => {
    const pct = data.allPcts[i];
    const row = [
      raw.name,
      parseFloat((pct * 100).toFixed(4)),
      parseFloat((pct * data.totalKg).toFixed(2)),
      raw.price,
      parseFloat((pct * raw.price).toFixed(2)),
      parseFloat((pct * raw.n).toFixed(2)),
      parseFloat((pct * raw.p).toFixed(2)),
      parseFloat((pct * raw.k).toFixed(2)),
      parseFloat((pct * raw.cl).toFixed(2))
    ];

    if (data.fixedInfo) {
      row.push(data.fixedInfo[i] ? '固定辅料' : '可变原料');
    }

    materialData.push(row);
  });

  // 合计行
  const totalPct = data.allPcts.reduce((s, p) => s + p, 0);
  const totalRow = [
    '合计',
    parseFloat((totalPct * 100).toFixed(2)),
    parseFloat((totalPct * data.totalKg).toFixed(2)),
    '',
    parseFloat(data.cost.toFixed(2)),
    parseFloat(data.actualN.toFixed(2)),
    parseFloat(data.actualP.toFixed(2)),
    parseFloat(data.actualK.toFixed(2)),
    parseFloat(data.actualCl.toFixed(2))
  ];

  if (data.fixedInfo) {
    totalRow.push('');
  }

  materialData.push(totalRow);

  const ws2 = XLSX.utils.aoa_to_sheet(materialData);
  ws2['!cols'] = [
    { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }
  ];
  XLSX.utils.book_append_sheet(wb, ws2, '原料明细');

  // ===== Sheet 3: 微量元素分析 =====
  if (Object.keys(data.traceResults).length > 0) {
    const traceData = [
      ['微量元素', '元素名称', '含量 (%)', '质量 (kg)']
    ];

    Object.entries(data.traceResults).forEach(([symbol, info]) => {
      traceData.push([
        symbol,
        info.name,
        parseFloat(info.value.toFixed(3)),
        parseFloat((info.value * data.totalKg / 100).toFixed(2))
      ]);
    });

    const ws3 = XLSX.utils.aoa_to_sheet(traceData);
    ws3['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws3, '微量元素分析');
  }

  // ===== Sheet 4: 原料微量元素明细 =====
  const allTraceSymbols = new Set();
  data.allRaws.forEach(raw => {
    if (raw.trace) {
      Object.keys(raw.trace).forEach(sym => allTraceSymbols.add(sym));
    }
  });

  if (allTraceSymbols.size > 0) {
    const traceDetailHeader = ['原料名称', '百分比 (%)'];
    const sortedSymbols = Array.from(allTraceSymbols).sort();
    sortedSymbols.forEach(sym => {
      const commonEl = COMMON_TRACE_ELEMENTS.find(el => el.symbol === sym);
      traceDetailHeader.push(commonEl ? `${commonEl.name}(${sym})` : sym);
    });

    const traceDetailData = [traceDetailHeader];

    data.allRaws.forEach((raw, i) => {
      const row = [raw.name, parseFloat((data.allPcts[i] * 100).toFixed(4))];
      sortedSymbols.forEach(sym => {
        const val = raw.trace?.[sym] || 0;
        row.push(val > 0 ? parseFloat(val.toFixed(3)) : '');
      });
      traceDetailData.push(row);
    });

    const ws4 = XLSX.utils.aoa_to_sheet(traceDetailData);
    const cols = [{ wch: 15 }, { wch: 12 }];
    sortedSymbols.forEach(() => cols.push({ wch: 12 }));
    ws4['!cols'] = cols;
    XLSX.utils.book_append_sheet(wb, ws4, '原料微量元素明细');
  }

  // ===== Sheet 5: 生产成本明细（仅核价计算） =====
  if (data.extraCost !== undefined && typeof costItems !== 'undefined') {
    const enabledItems = costItems.filter(c => c.enabled);
    const costSheetData = [
      ['生产成本明细'],
      [],
      ['成本项', '分类', '计算模式', '折算单价 (元/吨)']
    ];

    enabledItems.forEach(c => {
      costSheetData.push([
        c.name,
        COST_CATEGORIES[c.category] || c.category,
        c.mode === 'fixed' ? '固定单价' : '总额分摊',
        parseFloat(getCostUnitPrice(c).toFixed(2))
      ]);
    });

    costSheetData.push(
      [],
      ['成本汇总'],
      ['裸料成本 (元/吨)', parseFloat(data.cost.toFixed(2))],
      ['附加成本 (元/吨)', parseFloat(data.extraCost.toFixed(2))],
      ['生产总成本 (元/吨)', parseFloat(data.totalProductionCost.toFixed(2))],
      [],
      ['成本结构'],
      ['裸料占比', parseFloat((data.cost / data.totalProductionCost * 100).toFixed(1)) + '%'],
      ['附加占比', parseFloat((data.extraCost / data.totalProductionCost * 100).toFixed(1)) + '%']
    );

    const wsCost = XLSX.utils.aoa_to_sheet(costSheetData);
    wsCost['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsCost, '生产成本明细');
  }

  // 导出文件
  const filename = `水溶肥${data.type}报告_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
