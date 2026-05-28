/**
 * trace.js — 微量元素管理 & 详细报告弹窗
 */

/** 打开微量元素编辑弹窗 */
function openTraceEditor(rawIndex) {
  const raw = rawMaterials[rawIndex];
  if (!raw.trace) raw.trace = {};

  // 获取所有已使用的微量元素（包括自定义的）
  const allElements = new Set();
  COMMON_TRACE_ELEMENTS.forEach(el => allElements.add(el.symbol));
  Object.keys(raw.trace).forEach(sym => allElements.add(sym));

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>编辑微量元素 - ${escapeHtml(raw.name)}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>
      <div class="modal-body">
        <div class="alert alert-info">设置该原料中包含的微量元素含量（百分比 %）</div>

        <div class="section-title" style="font-size:15px;margin-bottom:12px">常用微量元素</div>
        <div class="trace-grid" id="common_trace_grid">
          ${COMMON_TRACE_ELEMENTS.map(el => `
            <div class="trace-item">
              <label>${el.name} (${el.symbol})</label>
              <input type="number"
                     id="trace_${el.symbol}"
                     value="${raw.trace[el.symbol] || 0}"
                     min="0"
                     max="100"
                     step="0.01"
                     placeholder="0">
              <span class="unit">%</span>
            </div>
          `).join('')}
        </div>

        ${Object.keys(raw.trace).filter(sym => !COMMON_TRACE_ELEMENTS.find(el => el.symbol === sym)).length > 0 ? `
        <div class="divider"></div>
        <div class="section-title" style="font-size:15px;margin-bottom:12px">自定义微量元素</div>
        <div class="trace-grid" id="custom_trace_grid">
          ${Object.keys(raw.trace).filter(sym => !COMMON_TRACE_ELEMENTS.find(el => el.symbol === sym)).map(sym => `
            <div class="trace-item">
              <label>${sym}</label>
              <input type="number"
                     id="trace_${sym}"
                     value="${raw.trace[sym] || 0}"
                     min="0"
                     max="100"
                     step="0.01"
                     placeholder="0">
              <span class="unit">%</span>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <div class="divider"></div>
        <div class="section-title" style="font-size:15px;margin-bottom:12px">添加自定义元素</div>
        <div style="display:flex;gap:10px;align-items:flex-end">
          <div style="flex:1">
            <label style="font-size:13px;font-weight:600;color:#444;margin-bottom:6px;display:block">元素符号</label>
            <input type="text" id="custom_symbol" placeholder="如：Si" style="width:100%">
          </div>
          <div style="flex:1">
            <label style="font-size:13px;font-weight:600;color:#444;margin-bottom:6px;display:block">元素名称（可选）</label>
            <input type="text" id="custom_name" placeholder="如：硅" style="width:100%">
          </div>
          <div style="flex:1">
            <label style="font-size:13px;font-weight:600;color:#444;margin-bottom:6px;display:block">含量 (%)</label>
            <input type="number" id="custom_value" placeholder="0" min="0" max="100" step="0.01" style="width:100%">
          </div>
          <button class="btn btn-success btn-sm" onclick="addCustomTraceElement(${rawIndex})">+ 添加</button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-danger" onclick="this.closest('.modal-overlay').remove()">取消</button>
        <button class="btn btn-success" onclick="saveTraceElements(${rawIndex})">保存</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

/** 添加自定义微量元素到编辑弹窗 */
function addCustomTraceElement(rawIndex) {
  const symbol = document.getElementById('custom_symbol').value.trim();
  const name = document.getElementById('custom_name').value.trim();
  const value = parseFloat(document.getElementById('custom_value').value) || 0;

  if (!symbol) {
    alert('请输入元素符号');
    return;
  }

  if (value <= 0) {
    alert('请输入有效的含量值');
    return;
  }

  // 检查是否已存在
  if (document.getElementById('trace_' + symbol)) {
    alert('该元素已存在，请直接修改其含量');
    return;
  }

  const raw = rawMaterials[rawIndex];
  if (!raw.trace) raw.trace = {};
  raw.trace[symbol] = value;

  // 重新打开弹窗以刷新显示
  document.querySelector('.modal-overlay').remove();
  openTraceEditor(rawIndex);
}

/** 保存微量元素数据 */
function saveTraceElements(rawIndex) {
  const raw = rawMaterials[rawIndex];
  raw.trace = {};

  // 保存常用元素
  COMMON_TRACE_ELEMENTS.forEach(el => {
    const input = document.getElementById('trace_' + el.symbol);
    const val = parseFloat(input.value) || 0;
    if (val > 0) raw.trace[el.symbol] = val;
  });

  // 保存自定义元素
  const customGrid = document.getElementById('custom_trace_grid');
  if (customGrid) {
    customGrid.querySelectorAll('.trace-item').forEach(item => {
      const label = item.querySelector('label').textContent.trim();
      const input = item.querySelector('input');
      const val = parseFloat(input.value) || 0;
      if (val > 0) raw.trace[label] = val;
    });
  }

  document.querySelector('.modal-overlay').remove();
  renderRawTable();
  saveAll();
}

/** 获取微量元素摘要文本 */
function getTraceSummary(trace) {
  if (!trace || Object.keys(trace).length === 0) return '无';
  return Object.entries(trace)
    .map(([sym, val]) => `${sym}:${fmt(val, 2)}%`)
    .join(', ');
}

/** 打开新增原料的微量元素快速设置弹窗 */
function openAddRawTraceEditor() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>设置微量元素</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>
      <div class="modal-body">
        <div class="alert alert-info">为新增原料设置微量元素含量（百分比 %）</div>

        <div class="section-title" style="font-size:15px;margin-bottom:12px">常用微量元素</div>
        <div class="trace-grid">
          ${COMMON_TRACE_ELEMENTS.map(el => `
            <div class="trace-item">
              <label>${el.name} (${el.symbol})</label>
              <input type="number"
                     id="addraw_trace_${el.symbol}"
                     value="0"
                     min="0"
                     max="100"
                     step="0.01"
                     placeholder="0">
              <span class="unit">%</span>
            </div>
          `).join('')}
        </div>

        <div class="divider"></div>
        <div class="section-title" style="font-size:15px;margin-bottom:12px">添加自定义元素</div>
        <div id="custom_elements_container"></div>
        <div style="display:flex;gap:10px;align-items:flex-end;margin-top:10px">
          <div style="flex:1">
            <label style="font-size:13px;font-weight:600;color:#444;margin-bottom:6px;display:block">元素符号</label>
            <input type="text" id="addraw_custom_symbol" placeholder="如：Si" style="width:100%">
          </div>
          <div style="flex:1">
            <label style="font-size:13px;font-weight:600;color:#444;margin-bottom:6px;display:block">元素名称（可选）</label>
            <input type="text" id="addraw_custom_name" placeholder="如：硅" style="width:100%">
          </div>
          <div style="flex:1">
            <label style="font-size:13px;font-weight:600;color:#444;margin-bottom:6px;display:block">含量 (%)</label>
            <input type="number" id="addraw_custom_value" placeholder="0" min="0" max="100" step="0.01" style="width:100%">
          </div>
          <button class="btn btn-success btn-sm" onclick="addCustomElementToNewRaw()">+ 添加</button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-danger" onclick="this.closest('.modal-overlay').remove()">取消</button>
        <button class="btn btn-success" onclick="confirmAddRawTrace()">确认</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// 临时存储新增原料的自定义元素
let tempCustomElements = [];

/** 添加自定义元素到新增原料 */
function addCustomElementToNewRaw() {
  const symbol = document.getElementById('addraw_custom_symbol').value.trim();
  const name = document.getElementById('addraw_custom_name').value.trim();
  const value = parseFloat(document.getElementById('addraw_custom_value').value) || 0;

  if (!symbol) {
    alert('请输入元素符号');
    return;
  }

  if (value <= 0) {
    alert('请输入有效的含量值');
    return;
  }

  // 检查是否已存在
  if (tempCustomElements.find(el => el.symbol === symbol)) {
    alert('该元素已添加');
    return;
  }

  tempCustomElements.push({ symbol, name, value });

  // 刷新显示
  const container = document.getElementById('custom_elements_container');
  container.innerHTML = `
    <div class="trace-grid" style="margin-bottom:10px">
      ${tempCustomElements.map((el, i) => `
        <div class="trace-item">
          <label>${el.name ? `${el.name} (${el.symbol})` : el.symbol}</label>
          <input type="number"
                 value="${el.value}"
                 min="0"
                 max="100"
                 step="0.01"
                 onchange="tempCustomElements[${i}].value=+this.value"
                 style="width:100%">
          <button class="btn btn-danger btn-sm" onclick="removeCustomElement(${i})" style="margin-top:4px;width:100%;padding:4px">删除</button>
        </div>
      `).join('')}
    </div>
  `;

  // 清空输入框
  document.getElementById('addraw_custom_symbol').value = '';
  document.getElementById('addraw_custom_name').value = '';
  document.getElementById('addraw_custom_value').value = '';
}

/** 删除自定义元素 */
function removeCustomElement(index) {
  tempCustomElements.splice(index, 1);
  addCustomElementToNewRaw(); // 刷新显示
}

/** 确认新增原料的微量元素设置 */
function confirmAddRawTrace() {
  const trace = {};

  // 收集常用元素
  COMMON_TRACE_ELEMENTS.forEach(el => {
    const input = document.getElementById('addraw_trace_' + el.symbol);
    const val = parseFloat(input.value) || 0;
    if (val > 0) trace[el.symbol] = val;
  });

  // 收集自定义元素
  tempCustomElements.forEach(el => {
    if (el.value > 0) trace[el.symbol] = el.value;
  });

  // 存储到临时变量供 addRaw 使用
  window.pendingRawTrace = trace;
  tempCustomElements = [];

  document.querySelector('.modal-overlay').remove();

  // 执行新增原料
  addRaw();
}

/** 打开详细报告弹窗（含量计算） */
function openFormulaDetailReport() {
  // 使用缓存的求解结果
  const cached = AppState.lastFormulaResult;
  if (!cached) {
    alert('请先完成配方求解');
    return;
  }

  const { allRaws, allPcts, totalKg } = cached;

  // 计算所有微量元素（包括自定义的）
  const traceResults = {};

  // 收集所有出现过的微量元素符号
  const allTraceSymbols = new Set();
  allRaws.forEach(raw => {
    if (raw.trace) {
      Object.keys(raw.trace).forEach(sym => allTraceSymbols.add(sym));
    }
  });

  // 计算每种微量元素的总含量（未归一化，showDetailReport 会按总百分比归一化）
  allTraceSymbols.forEach(symbol => {
    const total = allPcts.reduce((sum, pct, i) => {
      const raw = allRaws[i];
      return sum + pct * (raw.trace?.[symbol] || 0);
    }, 0);

    if (total > 0.001) {
      // 尝试从常用元素列表获取名称
      const commonEl = COMMON_TRACE_ELEMENTS.find(el => el.symbol === symbol);
      traceResults[symbol] = {
        name: commonEl ? commonEl.name : symbol,
        value: total
      };
    }
  });

  showDetailReport('含量计算详细报告', allRaws, allPcts, totalKg, traceResults);
}

/** 打开详细报告弹窗（核价计算） */
function openPricingDetailReport() {
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
  const allRaws = rows.map(r => r.raw);
  const allPcts = rows.map(r => r.pct);

  // 计算所有微量元素（包括自定义的）
  const traceResults = {};

  // 收集所有出现过的微量元素符号
  const allTraceSymbols = new Set();
  allRaws.forEach(raw => {
    if (raw.trace) {
      Object.keys(raw.trace).forEach(sym => allTraceSymbols.add(sym));
    }
  });

  // 计算每种微量元素的总含量（未归一化，showDetailReport 会按总百分比归一化）
  allTraceSymbols.forEach(symbol => {
    const total = allPcts.reduce((sum, pct, i) => {
      const raw = allRaws[i];
      return sum + pct * (raw.trace?.[symbol] || 0);
    }, 0);

    if (total > 0.001) {
      // 尝试从常用元素列表获取名称
      const commonEl = COMMON_TRACE_ELEMENTS.find(el => el.symbol === symbol);
      traceResults[symbol] = {
        name: commonEl ? commonEl.name : symbol,
        value: total
      };
    }
  });

  showDetailReport('核价计算详细报告', allRaws, allPcts, totalKg, traceResults, true);
}

/** 显示详细报告弹窗 */
function showDetailReport(title, allRaws, allPcts, totalKg, traceResults, showCostBreakdown) {
  const sumPct = allPcts.reduce((s, p) => s + (isFinite(p) ? p : 0), 0);
  // 详细报告按“目标总重量(totalKg)”口径展示：当百分比之和不等于1时先归一化，使占比合计=100%
  const denom = sumPct > 0 ? sumPct : 1;
  const totalMass = totalKg;

  const actualN = allPcts.reduce((s, p, i) => s + (p / denom) * allRaws[i].n, 0);
  const actualP = allPcts.reduce((s, p, i) => s + (p / denom) * allRaws[i].p, 0);
  const actualK = allPcts.reduce((s, p, i) => s + (p / denom) * allRaws[i].k, 0);
  const actualCl = allPcts.reduce((s, p, i) => s + (p / denom) * allRaws[i].cl, 0);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content modal-large">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>
      <div class="modal-body">
        <div class="section">
          <div class="section-title">主量元素分析</div>
          <div class="result-grid">
            <div class="result-card"><div class="val">${fmt(actualN, 2)}%</div><div class="lbl">氮 (N)</div></div>
            <div class="result-card"><div class="val">${fmt(actualP, 2)}%</div><div class="lbl">磷 (P)</div></div>
            <div class="result-card"><div class="val">${fmt(actualK, 2)}%</div><div class="lbl">钾 (K)</div></div>
            <div class="result-card orange"><div class="val">${fmt(actualCl, 2)}%</div><div class="lbl">氯 (Cl)</div></div>
          </div>
        </div>

        ${Object.keys(traceResults).length > 0 ? `
        <div class="section">
          <div class="section-title">微量元素分析</div>
          <div class="trace-result-grid">
            ${Object.entries(traceResults).map(([sym, data]) => `
              <div class="trace-result-card">
                <div class="trace-symbol">${sym}</div>
                <div class="trace-name">${data.name}</div>
                <div class="trace-value">${fmt(data.value / denom, 3)}%</div>
                <div class="trace-mass">${fmt((data.value / denom) * totalMass / 100, 2)} kg</div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : '<div class="alert alert-info">该配方未添加微量元素</div>'}

        <div class="section">
          <div class="section-title">原料明细</div>
          <table>
            <thead>
              <tr>
                <th>原料</th>
                <th>百分比</th>
                <th>用量 (kg)</th>
                <th>N</th>
                <th>P</th>
                <th>K</th>
                <th>Cl</th>
                <th>微量元素</th>
              </tr>
            </thead>
            <tbody>
              ${allRaws.map((raw, i) => `
                <tr>
                  <td>${escapeHtml(raw.name)}</td>
                  <td>${fmt((allPcts[i] / denom) * 100, 4)}%</td>
                  <td>${fmt((allPcts[i] / denom) * totalKg, 2)} kg</td>
                  <td>${fmt((allPcts[i] / denom) * raw.n, 2)}%</td>
                  <td>${fmt((allPcts[i] / denom) * raw.p, 2)}%</td>
                  <td>${fmt((allPcts[i] / denom) * raw.k, 2)}%</td>
                  <td>${fmt((allPcts[i] / denom) * raw.cl, 2)}%</td>
                  <td style="font-size:11px">${escapeHtml(getTraceSummary(raw.trace))}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background:#f0f4ff;font-weight:700">
                <td>合计</td>
                <td>100.00%</td>
                <td>${fmt(totalMass, 2)} kg</td>
                <td>${fmt(actualN, 2)}%</td>
                <td>${fmt(actualP, 2)}%</td>
                <td>${fmt(actualK, 2)}%</td>
                <td>${fmt(actualCl, 2)}%</td>
                <td>—</td>
              </tr>
            </tfoot>
          </table>
        </div>

        ${showCostBreakdown ? `
        <div class="section">
          <div class="section-title">生产成本分析</div>
          ${(() => {
            const rawCost = allPcts.reduce((s, p, i) => s + (p / denom) * allRaws[i].price, 0);
            const extraCost = getTotalExtraCost();
            const prodTotal = rawCost + extraCost;
            const enabledItems = costItems.filter(c => c.enabled);
            return `
            <div class="result-grid">
              <div class="result-card orange"><div class="val">${fmt(rawCost, 2)}</div><div class="lbl">裸料成本（元/吨）</div></div>
              <div class="result-card" style="background:linear-gradient(135deg,#06b6d4,#3b82f6)"><div class="val">${fmt(extraCost, 2)}</div><div class="lbl">附加成本（元/吨）</div></div>
              <div class="result-card" style="background:linear-gradient(135deg,#dc2626,#991b1b)"><div class="val">${fmt(prodTotal, 2)}</div><div class="lbl">生产总成本（元/吨）</div></div>
            </div>
            <table style="margin-top:16px">
              <thead><tr><th>成本项</th><th>分类</th><th>计算模式</th><th>折算单价（元/吨）</th></tr></thead>
              <tbody>
                ${enabledItems.map(c => `<tr>
                  <td>${c.name}</td>
                  <td><span class="badge badge-ok">${COST_CATEGORIES[c.category] || c.category}</span></td>
                  <td>${c.mode === 'fixed' ? '固定单价' : '总额分摊'}</td>
                  <td style="font-weight:700">${fmt(getCostUnitPrice(c), 2)}</td>
                </tr>`).join('')}
                <tr style="background:#f0f4ff;font-weight:700">
                  <td colspan="3">附加成本合计</td>
                  <td>${fmt(extraCost, 2)} 元/吨</td>
                </tr>
              </tbody>
            </table>
            <div class="alert alert-info" style="margin-top:12px">
              <b>成本结构：</b>裸料占比 ${fmt(rawCost / prodTotal * 100, 1)}% | 附加占比 ${fmt(extraCost / prodTotal * 100, 1)}%
            </div>`;
          })()}
        </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        <button class="btn btn-success" onclick="exportCurrentReport('${title}')">📥 导出 Excel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // 存储当前报告数据供导出使用
  window.currentReportData = { title, allRaws, allPcts, totalKg, traceResults, showCostBreakdown };
}

/** 导出当前详细报告 */
function exportCurrentReport(title) {
  if (!window.currentReportData) {
    alert('无法导出：报告数据不存在');
    return;
  }

  const data = window.currentReportData;
  const allRaws = data.allRaws;
  const allPcts = data.allPcts;
  const totalKg = data.totalKg;

  const actualN = allPcts.reduce((s, p, i) => s + p * allRaws[i].n, 0);
  const actualP = allPcts.reduce((s, p, i) => s + p * allRaws[i].p, 0);
  const actualK = allPcts.reduce((s, p, i) => s + p * allRaws[i].k, 0);
  const actualCl = allPcts.reduce((s, p, i) => s + p * allRaws[i].cl, 0);
  const actualNPK = actualN + actualP + actualK;
  const cost = allPcts.reduce((s, p, i) => s + p * allRaws[i].price, 0);

  // 根据标题判断是含量计算还是核价计算
  const isFormula = title.includes('含量计算');

  const exportData = {
    type: isFormula ? '含量计算' : '核价计算',
    targetN: isFormula ? +document.getElementById('f_targetN').value : +document.getElementById('p_targetN').value,
    targetP: isFormula ? +document.getElementById('f_targetP').value : +document.getElementById('p_targetP').value,
    targetK: isFormula ? +document.getElementById('f_targetK').value : +document.getElementById('p_targetK').value,
    totalKg: totalKg,
    actualN, actualP, actualK, actualCl, actualNPK,
    cost,
    allRaws, allPcts,
    traceResults: data.traceResults
  };

  if (isFormula) {
    exportData.minNPK = +document.getElementById('f_minNPK').value;
  }

  // 核价计算报告包含附加成本
  if (data.showCostBreakdown) {
    exportData.extraCost = getTotalExtraCost();
    exportData.totalProductionCost = cost + exportData.extraCost;
  }

  generateExcelReport(exportData);
}
