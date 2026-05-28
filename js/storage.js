/**
 * storage.js — localStorage 持久化
 * 负责保存、加载、导出、导入、清空配置
 */

const LS_KEY = 'feiliao_v1';

/** 将当前所有状态序列化并写入 localStorage */
function saveAll() {
  const data = {
    rawMaterials,
    formulaRows,
    fixedRows,
    pricingRows,
    costItems,
    formulaParams: {
      targetN: document.getElementById('f_targetN')?.value,
      targetP: document.getElementById('f_targetP')?.value,
      targetK: document.getElementById('f_targetK')?.value,
      total:   document.getElementById('f_total')?.value,
      minNPK:  document.getElementById('f_minNPK')?.value,
    },
    pricingParams: {
      targetN: document.getElementById('p_targetN')?.value,
      targetP: document.getElementById('p_targetP')?.value,
      targetK: document.getElementById('p_targetK')?.value,
      total:   document.getElementById('p_total')?.value,
    },
  };
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (e) {}
}

/** 从 localStorage 恢复状态，成功返回 true */
function loadAll() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);

    if (data.rawMaterials) rawMaterials = data.rawMaterials;
    if (data.formulaRows)  formulaRows  = data.formulaRows;
    if (data.fixedRows)    fixedRows    = data.fixedRows;
    if (data.pricingRows)  pricingRows  = data.pricingRows;
    if (data.costItems)    costItems    = data.costItems;

    // DOM 尚未完全渲染，延迟恢复 input 值
    if (data.formulaParams) {
      setTimeout(() => {
        const p = data.formulaParams;
        if (p.targetN) document.getElementById('f_targetN').value = p.targetN;
        if (p.targetP) document.getElementById('f_targetP').value = p.targetP;
        if (p.targetK) document.getElementById('f_targetK').value = p.targetK;
        if (p.total)   document.getElementById('f_total').value   = p.total;
        if (p.minNPK)  document.getElementById('f_minNPK').value  = p.minNPK;
      }, 0);
    }
    if (data.pricingParams) {
      setTimeout(() => {
        const p = data.pricingParams;
        if (p.targetN) document.getElementById('p_targetN').value = p.targetN;
        if (p.targetP) document.getElementById('p_targetP').value = p.targetP;
        if (p.targetK) document.getElementById('p_targetK').value = p.targetK;
        if (p.total)   document.getElementById('p_total').value   = p.total;
      }, 0);
    }
    return true;
  } catch (e) { return false; }
}

/** 将当前配置导出为 JSON 文件（含配方库） */
function exportConfig() {
  saveAll();
  const mainData = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  const recipes = JSON.parse(localStorage.getItem('feiliao_recipes') || '[]');
  const exportData = { ...mainData, recipes, exportVersion: '2.0' };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '水溶肥配置_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
}

/** 从 JSON 文件导入配置 */
function importConfig() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        // 如果包含配方库，单独存储
        if (parsed.recipes) {
          localStorage.setItem('feiliao_recipes', JSON.stringify(parsed.recipes));
          delete parsed.recipes;
          delete parsed.exportVersion;
        }
        localStorage.setItem(LS_KEY, JSON.stringify(parsed));
        loadAll();
        renderRawTable();
        renderFormulaRows();
        renderFixedRows();
        renderPricingRows();
        renderCostTab();
        alert('配置导入成功！');
      } catch { alert('文件格式错误，导入失败'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

/** 清空本地数据，恢复 Excel 默认值 */
function clearLocalData() {
  if (!confirm('确认清空本地数据，恢复默认原料？')) return;
  localStorage.removeItem(LS_KEY);
  rawMaterials = JSON.parse(JSON.stringify(DEFAULT_RAW));
  formulaRows  = JSON.parse(JSON.stringify(DEFAULT_FORMULA_ROWS));
  fixedRows    = JSON.parse(JSON.stringify(DEFAULT_FIXED_ROWS));
  pricingRows  = JSON.parse(JSON.stringify(DEFAULT_PRICING_ROWS));
  costItems    = JSON.parse(JSON.stringify(DEFAULT_COST_ITEMS));
  renderRawTable();
  renderFormulaRows();
  renderFixedRows();
  renderPricingRows();
  renderCostTab();
  alert('已恢复默认数据');
}
