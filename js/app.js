/**
 * app.js — 应用初始化 & Tab 切换
 * 全局状态变量、Tab 切换逻辑、页面初始化
 */

// ===== 全局状态对象 =====
const AppState = {
  rawMaterials: JSON.parse(JSON.stringify(DEFAULT_RAW)),
  formulaRows: JSON.parse(JSON.stringify(DEFAULT_FORMULA_ROWS)),
  fixedRows: JSON.parse(JSON.stringify(DEFAULT_FIXED_ROWS)),
  pricingRows: JSON.parse(JSON.stringify(DEFAULT_PRICING_ROWS)),
  costItems: JSON.parse(JSON.stringify(DEFAULT_COST_ITEMS)),
  // 求解缓存
  lastFormulaResult: null,
  lastPricingResult: null,
};

// 向后兼容的全局别名
let rawMaterials = AppState.rawMaterials;
let formulaRows  = AppState.formulaRows;
let fixedRows    = AppState.fixedRows;
let pricingRows  = AppState.pricingRows;

// ===== Tab 切换 =====
const TAB_NAMES = ['raw', 'formula', 'pricing', 'recipes', 'cost', 'license'];

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    b.classList.toggle('active', TAB_NAMES[i] === name);
  });
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');

  if (name === 'raw')     renderRawTable();
  if (name === 'formula') { renderFormulaRows(); renderFixedRows(); }
  if (name === 'pricing') { renderPricingRows(); calcPricing(); }
  if (name === 'recipes') renderRecipeTab();
  if (name === 'cost')    renderCostTab();
  if (name === 'license') renderLicenseTab();
}

// ===== 页面初始化 =====
window.addEventListener('DOMContentLoaded', () => {
  // 尝试从 localStorage 恢复数据
  loadAll();

  // 渲染初始界面
  renderRawTable();
  renderFormulaRows();
  renderFixedRows();
  renderPricingRows();
  renderCostTab();

  // 自动备份（每天一次）
  autoBackup();

  // 输入框变更时自动保存
  ['f_targetN', 'f_targetP', 'f_targetK', 'f_total', 'f_minNPK',
   'p_targetN', 'p_targetP', 'p_targetK', 'p_total'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', saveAll);
  });
});

/** 自动备份（每天最多一次） */
async function autoBackup() {
  if (!window.electronAPI || !window.electronAPI.saveBackup) return;

  const lastBackup = localStorage.getItem('last_backup_date');
  const today = new Date().toISOString().slice(0, 10);

  if (lastBackup === today) return; // 今天已备份

  const mainData = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  const recipes = JSON.parse(localStorage.getItem('feiliao_recipes') || '[]');
  const backupData = { ...mainData, recipes, backupDate: today, version: '2.0' };

  const result = await window.electronAPI.saveBackup(backupData);
  if (result.success) {
    localStorage.setItem('last_backup_date', today);
    console.log('Auto backup saved:', result.path);
  }
}