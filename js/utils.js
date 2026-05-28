/**
 * utils.js — 通用工具函数
 * 格式化、原料查找、下拉框构建、联动更新
 */

/** HTML 转义，防止 XSS */
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

/** 数字格式化，默认保留 2 位小数 */
function fmt(v, d = 2) {
  return isNaN(v) ? '—' : Number(v).toFixed(d);
}

/** 磷元素态转氧化物态 P → P₂O₅ */
function toP2O5(p) {
  return p * 2.2914;
}

/** 钾元素态转氧化物态 K → K₂O */
function toK2O(k) {
  return k * 1.2046;
}

/** 生成国标格式养分标签 N-P₂O₅-K₂O */
function npkLabel(n, p, k) {
  return `${fmt(n,1)}-${fmt(toP2O5(p),1)}-${fmt(toK2O(k),1)}`;
}

/**
 * 预估混合溶液 pH 值
 * 基于加权平均法（简化模型）：
 * - 将 pH 转为 H+ 浓度（10^-pH）
 * - 按质量比加权平均 H+ 浓度
 * - 再转回 pH
 * 注意：这是粗略估算，实际 pH 受缓冲体系、离子强度等影响
 */
function estimatePH(allRaws, allPcts) {
  let totalH = 0;
  let totalWeight = 0;

  for (let i = 0; i < allRaws.length; i++) {
    const ph = allRaws[i].ph || 7;
    const pct = allPcts[i] || 0;
    if (pct <= 0) continue;

    // H+ 浓度 = 10^(-pH)
    const hConc = Math.pow(10, -ph);
    totalH += hConc * pct;
    totalWeight += pct;
  }

  if (totalWeight <= 0) return 7.0;

  const avgH = totalH / totalWeight;
  const estimatedPH = -Math.log10(avgH);

  // 限制在合理范围
  return Math.max(1, Math.min(14, estimatedPH));
}

/**
 * 获取 pH 等级描述和颜色
 * 水溶肥国标要求 pH 3.0-7.0（酸性到中性）
 */
function getPHStatus(ph) {
  if (ph >= 3.0 && ph <= 7.0) {
    return { text: '达标', cls: 'badge-ok', color: '#11998e' };
  } else if (ph > 7.0 && ph <= 8.0) {
    return { text: '偏碱', cls: 'badge-warn', color: '#f57c00' };
  } else if (ph < 3.0) {
    return { text: '过酸', cls: 'badge-err', color: '#f5576c' };
  } else {
    return { text: '超标', cls: 'badge-err', color: '#f5576c' };
  }
}

/**
 * 自动判定产品类型和执行标准
 * @param {number} n - 实际氮含量 (%)
 * @param {number} p - 实际磷含量 (%)
 * @param {number} k - 实际钾含量 (%)
 * @param {number} cl - 实际氯含量 (%)
 * @param {object} traceResults - 微量元素结果
 * @returns {object} { type, standard, clType }
 */
function judgeProductType(n, p, k, cl, traceResults) {
  const p2o5 = toP2O5(p);
  const k2o = toK2O(k);
  const totalNPK = n + p2o5 + k2o;

  // 氯含量分类
  let clType = '含氯';
  if (cl <= 3) clType = '无氯';
  else if (cl <= 15) clType = '低氯';

  // 微量元素分析
  const traceEntries = traceResults ? Object.entries(traceResults) : [];

  // 中量元素（Ca、Mg、S）
  const ca = traceResults && traceResults['Ca'] ? traceResults['Ca'].value : 0;
  const mg = traceResults && traceResults['Mg'] ? traceResults['Mg'].value : 0;
  const s  = traceResults && traceResults['S']  ? traceResults['S'].value  : 0;
  const mediumTotal = ca + mg;

  // 功能性成分
  const humic    = traceResults && traceResults['腐殖酸']   ? traceResults['腐殖酸'].value   : 0;
  const fulvic   = traceResults && traceResults['黄腐酸']   ? traceResults['黄腐酸'].value   : 0;
  const amino    = traceResults && traceResults['氨基酸']   ? traceResults['氨基酸'].value   : 0;
  const seaweed  = traceResults && traceResults['海藻酸']   ? traceResults['海藻酸'].value   : 0;
  const chitin   = traceResults && traceResults['甲壳素']   ? traceResults['甲壳素'].value   : 0;
  const polyGlu  = traceResults && traceResults['聚谷氨酸'] ? traceResults['聚谷氨酸'].value : 0;
  const organic  = traceResults && traceResults['有机质']   ? traceResults['有机质'].value   : 0;
  const nitroHumic = traceResults && traceResults['硝基腐殖酸'] ? traceResults['硝基腐殖酸'].value : 0;

  // 微量元素（Fe/Mn/Zn/Cu/B/Mo/Co）
  const microElements = ['Fe', 'Mn', 'Zn', 'Cu', 'B', 'Mo', 'Co'];
  const microTotal = traceEntries
    .filter(([name]) => microElements.includes(name))
    .reduce((s, [, t]) => s + (t.value || 0), 0);

  // 螯合态微量元素
  const chelatedMicro = traceResults && traceResults['螯合微量'] ? traceResults['螯合微量'].value : 0;

  // 判定产品类型（按优先级排列）
  let type, standard, note;

  // === 功能性水溶肥（优先判定） ===

  if (humic >= 3 && totalNPK >= 20) {
    type = '含腐殖酸水溶肥料';
    standard = 'NY 1106-2020';
    note = `腐殖酸≥3%（实际${fmt(humic,1)}%），N+P₂O₅+K₂O≥20%（实际${fmt(totalNPK,1)}%）`;
  } else if (fulvic >= 3 && totalNPK >= 20) {
    type = '含黄腐酸水溶肥料';
    standard = 'HG/T 5332-2018';
    note = `黄腐酸≥3%（实际${fmt(fulvic,1)}%），N+P₂O₅+K₂O≥20%（实际${fmt(totalNPK,1)}%）`;
  } else if (nitroHumic >= 3 && totalNPK >= 20) {
    type = '含硝基腐殖酸水溶肥料';
    standard = 'HG/T 4365-2012';
    note = `硝基腐殖酸≥3%（实际${fmt(nitroHumic,1)}%）`;
  } else if (amino >= 10 && totalNPK >= 18) {
    type = '含氨基酸水溶肥料';
    standard = 'NY 1429-2010';
    note = `游离氨基酸≥10%（实际${fmt(amino,1)}%），N+P₂O₅+K₂O≥18%（实际${fmt(totalNPK,1)}%）`;
  } else if (seaweed >= 2 && totalNPK >= 20) {
    type = '含海藻酸水溶肥料';
    standard = 'NY/T 3692-2020';
    note = `海藻酸≥2%（实际${fmt(seaweed,1)}%），N+P₂O₅+K₂O≥20%（实际${fmt(totalNPK,1)}%）`;
  } else if (chitin >= 2) {
    type = '含甲壳素水溶肥料';
    standard = 'HG/T 5765-2020';
    note = `甲壳素≥2%（实际${fmt(chitin,1)}%）`;
  } else if (polyGlu >= 0.01 && totalNPK >= 20) {
    type = '含聚谷氨酸水溶肥料';
    standard = 'HG/T 5514-2019';
    note = `γ-聚谷氨酸≥0.01%（实际${fmt(polyGlu,2)}%），N+P₂O₅+K₂O≥20%（实际${fmt(totalNPK,1)}%）`;
  } else if (organic >= 5 && totalNPK >= 10) {
    type = '有机水溶肥料';
    standard = 'HG/T 5519-2019';
    note = `有机质≥5%（实际${fmt(organic,1)}%），N+P₂O₅+K₂O≥10%（实际${fmt(totalNPK,1)}%）`;

  // === 大量元素水溶肥 ===

  } else if (totalNPK >= 50) {
    type = '大量元素水溶肥料';
    standard = 'NY 1107-2020';
    note = `N+P₂O₅+K₂O≥50%（实际${fmt(totalNPK,1)}%）`;
    // 细分：是否含微量元素
    if (microTotal >= 0.5) {
      note += `，含微量元素${fmt(microTotal,1)}%`;
    }
  } else if (totalNPK >= 40 && totalNPK < 50) {
    type = '大量元素水溶肥料（养分偏低）';
    standard = 'NY 1107-2020';
    note = `N+P₂O₅+K₂O=${fmt(totalNPK,1)}%，国标要求≥50%，需提升养分含量`;

  // === 中量/微量元素水溶肥 ===

  } else if (mediumTotal >= 6 && totalNPK >= 10) {
    type = '中量元素水溶肥料';
    standard = 'NY 2266-2012';
    note = `Ca+Mg≥6%（实际${fmt(mediumTotal,1)}%），单一中量元素≥2%`;
  } else if (ca >= 10) {
    type = '中量元素水溶肥料（钙肥）';
    standard = 'NY 2266-2012';
    note = `Ca≥10%（实际${fmt(ca,1)}%）`;
  } else if (microTotal >= 10) {
    type = '微量元素水溶肥料';
    standard = 'NY 1428-2010';
    note = `微量元素总量≥10%（实际${fmt(microTotal,1)}%）`;
  } else if (chelatedMicro >= 2) {
    type = '螯合微量元素水溶肥料';
    standard = 'HG/T 5334-2018';
    note = `螯合态微量元素≥2%（实际${fmt(chelatedMicro,1)}%）`;
  } else if (microTotal >= 2 && totalNPK >= 18) {
    type = '大量元素水溶肥料（含微量元素型）';
    standard = 'NY 1107-2020';
    note = `微量元素${fmt(microTotal,1)}%，建议标注含微量元素`;

  // === 特殊单一产品 ===

  } else if (n === 0 && p2o5 >= 50 && k2o >= 30 && totalNPK >= 86) {
    type = '磷酸二氢钾（水溶肥）';
    standard = 'HG/T 2321-2016';
    note = `P₂O₅≥51.5%，K₂O≥34%，符合磷酸二氢钾标准`;
  } else if (n >= 46 && p === 0 && k === 0) {
    type = '尿素（单质氮肥）';
    standard = 'GB/T 2440-2017';
    note = `N≥46%，符合尿素标准`;
  } else if (k2o >= 50 && n === 0 && p === 0 && cl <= 3) {
    type = '硫酸钾';
    standard = 'GB/T 20406-2017';
    note = `K₂O≥50%，Cl≤3%`;

  // === 兜底 ===

  } else if (totalNPK >= 20) {
    type = '大量元素水溶肥料（待提升养分）';
    standard = 'NY 1107-2020';
    note = `N+P₂O₅+K₂O=${fmt(totalNPK,1)}%，国标要求≥50%`;
  } else if (totalNPK > 0) {
    type = '其他类型（养分不足）';
    standard = '需人工判定';
    note = `N+P₂O₅+K₂O=${fmt(totalNPK,1)}%，不满足水溶肥标准门槛`;
  } else {
    type = '功能性肥料/土壤调理剂';
    standard = '需人工判定';
    note = '无主要养分，可能属于土壤调理剂（NY/T 3034-2016）或植物生长调节剂';
  }

  return { type, standard, clType, totalNPK: fmt(totalNPK, 1), note };
}

/** 根据名称查找原料对象 */
function getRaw(name) {
  return rawMaterials.find(r => r.name === name) || null;
}

/** 获取新增行的默认原料名：优先“空白”，否则取第一项 */
function getDefaultRawName() {
  const blank = rawMaterials.find(r => r.name === '空白');
  if (blank) return blank.name;
  return rawMaterials[0]?.name || '';
}

/** 清理计算页引用已删除原料的行（直接删除，不显示“已不存在”） */
function sanitizeAllRows() {
  const exists = (name) => !!getRaw(name);

  if (Array.isArray(formulaRows)) {
    formulaRows = formulaRows.filter(r => r && exists(r.name));
    if (formulaRows.length === 0) formulaRows = [{ name: getDefaultRawName() }];
  }
  if (Array.isArray(fixedRows)) {
    fixedRows = fixedRows.filter(r => r && exists(r.name));
  }
  if (Array.isArray(pricingRows)) {
    pricingRows = pricingRows.filter(r => r && exists(r.name));
    if (pricingRows.length === 0) pricingRows = [{ name: getDefaultRawName(), fixed: false, pct: 0 }];
  }
}

/**
 * 构建原料下拉框 HTML
 * @param {string} id - select 元素的 id
 * @param {string} selectedName - 当前选中的原料名
 */
function buildSelect(id, selectedName = '') {
  const exists = !!getRaw(selectedName);
  const missingOpt = (!exists && selectedName)
    ? `<option value="${escapeHtml(selectedName)}" selected>${escapeHtml(selectedName)}（已不存在）</option>`
    : '';
  const opts = missingOpt + rawMaterials
    .map(r => `<option value="${escapeHtml(r.name)}" ${r.name === selectedName ? 'selected' : ''}>${escapeHtml(r.name)}</option>`)
    .join('');
  return `<select id="${id}" onchange="onSelectChange('${id}')">${opts}</select>`;
}

/**
 * 下拉框选中变更时，同步同行的养分显示字段，并按 tab 同步状态
 * @param {string} id - 触发变更的 select 元素 id
 */
function onSelectChange(id) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const raw = getRaw(sel.value);
  const prefix = id.replace('_sel', '');

  const nEl   = document.getElementById(prefix + '_n');
  const pEl   = document.getElementById(prefix + '_p');
  const kEl   = document.getElementById(prefix + '_k');
  const prEl  = document.getElementById(prefix + '_price');
  const fmEl  = document.getElementById(prefix + '_formula');

  if (raw) {
    if (nEl)  nEl.textContent  = fmt(raw.n, 1) + '%';
    if (pEl)  pEl.textContent  = fmt(raw.p, 1) + '%';
    if (kEl)  kEl.textContent  = fmt(raw.k, 1) + '%';
    if (prEl) prEl.textContent = raw.price.toLocaleString() + '元/吨';
    if (fmEl) fmEl.textContent = raw.n + '-' + raw.p + '-' + raw.k;
  }

  // 按前缀同步状态到对应数组
  if (id.startsWith('fr')) {
    const idx = parseInt(id.replace('fr', '').replace('_sel', ''));
    if (formulaRows[idx]) formulaRows[idx].name = sel.value;
  } else if (id.startsWith('fx')) {
    const idx = parseInt(id.replace('fx', '').replace('_sel', ''));
    if (fixedRows[idx]) fixedRows[idx].name = sel.value;
  } else if (id.startsWith('pr')) {
    const idx = parseInt(id.replace('pr', '').replace('_sel', ''));
    if (pricingRows[idx]) pricingRows[idx].name = sel.value;
    calcPricing();
  }

  saveAll();
}
