/**
 * raw.js — 原料管理模块
 * 渲染原料表格、新增原料、删除原料
 */

/** 渲染原料库表格 */
function renderRawTable() {
  const tbody = document.getElementById('rawBody');
  tbody.innerHTML = rawMaterials.map((r, i) => {
    if (!r.trace) r.trace = {}; // 兼容旧数据
    if (!r.priceHistory) r.priceHistory = []; // 兼容旧数据
    const traceSummary = getTraceSummary(r.trace);
    return `
    <tr>
      <td><input type="text"   value="${escapeHtml(r.name)}"  onchange="rawMaterials[${i}].name=this.value;renderRawTable();saveAll()" style="width:90px"></td>
      <td>
        <input type="number" value="${r.price}" onchange="updateRawPrice(${i}, +this.value);saveAll()" style="width:100px">
        ${r.priceHistory && r.priceHistory.length > 0 ? `<button class="btn btn-sm" onclick="openPriceHistory(${i})" style="padding:2px 6px;font-size:10px;margin-left:4px" title="查看价格历史">📈</button>` : ''}
      </td>
      <td><input type="number" value="${r.n}"     step="0.1" onchange="rawMaterials[${i}].n=+this.value;saveAll()" style="width:70px"></td>
      <td><input type="number" value="${r.p}"     step="0.1" onchange="rawMaterials[${i}].p=+this.value;saveAll()" style="width:70px"></td>
      <td><input type="number" value="${r.k}"     step="0.1" onchange="rawMaterials[${i}].k=+this.value;saveAll()" style="width:70px"></td>
      <td><input type="number" value="${r.cl}"    step="0.1" onchange="rawMaterials[${i}].cl=+this.value;saveAll()" style="width:70px"></td>
      <td><input type="number" value="${r.ph || 7}" step="0.1" min="0" max="14" onchange="rawMaterials[${i}].ph=+this.value;saveAll()" style="width:60px"></td>
      <td><span class="tag">${r.n}-${r.p}-${r.k}</span></td>
      <td>
        <button class="btn btn-sm" onclick="openTraceEditor(${i})" style="padding:4px 10px;font-size:11px">
          ${Object.keys(r.trace).length > 0 ? '✓ ' + Object.keys(r.trace).length + '种' : '+ 添加'}
        </button>
        <div style="font-size:10px;color:#666;margin-top:2px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(traceSummary)}">${escapeHtml(traceSummary)}</div>
      </td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteRaw(${i})">删除</button></td>
    </tr>`;
  }).join('');
}

/** 新增原料 */
function addRaw() {
  const name  = document.getElementById('add_name').value.trim();
  const price = +document.getElementById('add_price').value || 0;
  const n     = +document.getElementById('add_n').value     || 0;
  const p     = +document.getElementById('add_p').value     || 0;
  const k     = +document.getElementById('add_k').value     || 0;
  const cl    = +document.getElementById('add_cl').value    || 0;
  const ph    = +document.getElementById('add_ph').value    || 7;

  if (!name) { alert('请输入品种名称'); return; }

  // 获取微量元素数据（如果有）
  const trace = window.pendingRawTrace || {};
  delete window.pendingRawTrace;

  rawMaterials.push({ name, price, n, p, k, cl, ph, priceHistory: [], trace });
  renderRawTable();
  saveAll();
  ['add_name','add_price','add_n','add_p','add_k','add_cl','add_ph']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('add_ph').value = '7';
}

/** 删除原料 */
function deleteRaw(i) {
  const deletedName = rawMaterials[i]?.name;
  if (!deletedName) return;
  if (!confirm('确认删除原料：' + deletedName + '？\n\n注意：将同步删除所有计算页面中引用该原料的行。')) return;

  // 删除前先把各计算页当前下拉框选择同步回状态
  // （否则用户刚在页面上选了原料，但数组里还是旧值，联动清理会漏删）
  try {
    // 核价页已有同步函数
    if (typeof syncPricingRowsFromDOM === 'function') syncPricingRowsFromDOM();
  } catch (e) {}
  try {
    // 含量计算：可变原料行
    if (typeof formulaRows !== 'undefined' && Array.isArray(formulaRows)) {
      for (let fi = 0; fi < formulaRows.length; fi++) {
        const sel = document.getElementById('fr' + fi + '_sel');
        if (sel) formulaRows[fi].name = sel.value;
      }
    }
  } catch (e) {}
  try {
    // 含量计算：固定辅料行
    if (typeof fixedRows !== 'undefined' && Array.isArray(fixedRows)) {
      for (let xi = 0; xi < fixedRows.length; xi++) {
        const sel = document.getElementById('fx' + xi + '_sel');
        if (sel) fixedRows[xi].name = sel.value;
      }
    }
  } catch (e) {}

  rawMaterials.splice(i, 1);

  // 联动清理：删除所有计算模块中引用该原料的行
  formulaRows = (formulaRows || []).filter(r => r?.name !== deletedName);
  fixedRows   = (fixedRows || []).filter(r => r?.name !== deletedName);
  pricingRows = (pricingRows || []).filter(r => r?.name !== deletedName);

  // 防止可变原料行/核价行被清空后页面异常：补一行默认值（优先“空白”）
  if (!formulaRows || formulaRows.length === 0) {
    formulaRows = [{ name: getDefaultRawName() }];
  }
  if (!pricingRows || pricingRows.length === 0) {
    pricingRows = [{ name: getDefaultRawName(), fixed: false, pct: 0 }];
  }

  renderRawTable();
  // 其他 tab 可能未激活，但也要同步状态，确保切换过去是干净的
  renderFormulaRows();
  renderFixedRows();
  renderPricingRows();
  saveAll();
}

/** 更新原料价格（记录历史） */
function updateRawPrice(i, newPrice) {
  const raw = rawMaterials[i];
  if (!raw) return;

  // 记录历史（仅当价格真正变化时）
  if (raw.price !== newPrice) {
    if (!raw.priceHistory) raw.priceHistory = [];
    raw.priceHistory.push({
      date: new Date().toISOString().slice(0, 10),
      price: newPrice
    });
  }

  raw.price = newPrice;
  renderRawTable();
}
