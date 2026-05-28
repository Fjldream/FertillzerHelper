/**
 * cost.js — 生产附加成本管理模块
 * 管理电费、包材、人工等非原料成本项，仅在核价计算中使用
 */

// 成本分类映射
const COST_CATEGORIES = {
  energy: '能源',
  material: '包材',
  labor: '人工',
  logistics: '物流',
  depreciation: '折旧',
  overhead: '管理',
  custom: '自定义'
};

// 预设成本项
const DEFAULT_COST_ITEMS = [
  { id: 'electricity', name: '电费', category: 'energy', mode: 'fixed', unitCost: 50, totalAmount: 0, monthlyOutput: 500, enabled: true },
  { id: 'gas', name: '燃气/蒸汽', category: 'energy', mode: 'fixed', unitCost: 30, totalAmount: 0, monthlyOutput: 500, enabled: true },
  { id: 'package', name: '包装袋', category: 'material', mode: 'fixed', unitCost: 80, totalAmount: 0, monthlyOutput: 500, enabled: true },
  { id: 'label', name: '标签/喷码', category: 'material', mode: 'fixed', unitCost: 5, totalAmount: 0, monthlyOutput: 500, enabled: true },
  { id: 'labor_prod', name: '生产人工', category: 'labor', mode: 'fixed', unitCost: 120, totalAmount: 0, monthlyOutput: 500, enabled: true },
  { id: 'labor_qa', name: '质检人工', category: 'labor', mode: 'fixed', unitCost: 20, totalAmount: 0, monthlyOutput: 500, enabled: true },
  { id: 'transport', name: '厂内运输', category: 'logistics', mode: 'fixed', unitCost: 15, totalAmount: 0, monthlyOutput: 500, enabled: false },
  { id: 'depreciation', name: '设备折旧', category: 'depreciation', mode: 'fixed', unitCost: 60, totalAmount: 0, monthlyOutput: 500, enabled: true },
  { id: 'overhead', name: '制造费用', category: 'overhead', mode: 'fixed', unitCost: 40, totalAmount: 0, monthlyOutput: 500, enabled: true },
];

// 全局成本项数组（由 AppState 管理，此处保留向后兼容引用）
let costItems = JSON.parse(JSON.stringify(DEFAULT_COST_ITEMS));

/** 计算单项折算单价 */
function getCostUnitPrice(item) {
  if (item.mode === 'fixed') return item.unitCost || 0;
  if (item.mode === 'split' && item.monthlyOutput > 0) return item.totalAmount / item.monthlyOutput;
  return 0;
}

/** 计算所有已启用成本项的总附加成本(元/吨) */
function getTotalExtraCost() {
  return costItems.filter(c => c.enabled).reduce((sum, c) => sum + getCostUnitPrice(c), 0);
}

/** 渲染成本管理Tab */
function renderCostTab() {
  const totalExtra = getTotalExtraCost();
  const enabledCount = costItems.filter(c => c.enabled).length;

  const cont = document.getElementById('tab-cost');
  if (!cont) return;

  const summaryHTML = `
    <div class="section">
      <div class="section-title">成本汇总</div>
      <div class="result-grid">
        <div class="result-card orange"><div class="val">${fmt(totalExtra, 2)}</div><div class="lbl">总附加成本（元/吨）</div></div>
        <div class="result-card green"><div class="val">${enabledCount} / ${costItems.length}</div><div class="lbl">已启用项数</div></div>
      </div>
    </div>`;

  const tableHTML = `
    <div class="section">
      <div class="section-title">成本项管理</div>
      <div class="alert alert-info">管理生产附加成本项，这些成本仅在核价计算中叠加到裸料成本上。支持"固定单价"和"总额分摊"两种计算模式。</div>
      <table>
        <thead>
          <tr>
            <th>启用</th><th>分类</th><th>名称</th><th>计算模式</th>
            <th>单价(元/吨)</th><th>总额(元)</th><th>月产量(吨)</th>
            <th>折算单价(元/吨)</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${costItems.map((item, i) => {
            const unitPrice = getCostUnitPrice(item);
            return `<tr style="${item.enabled ? '' : 'opacity:0.5'}">
              <td><input type="checkbox" ${item.enabled ? 'checked' : ''} onchange="toggleCostEnabled(${i}, this.checked)" style="width:auto;transform:scale(1.3)"></td>
              <td><span class="badge badge-ok">${COST_CATEGORIES[item.category] || item.category}</span></td>
              <td>${item.id.startsWith('custom_') ? `<input type="text" value="${escapeHtml(item.name)}" style="width:100px" onchange="costItems[${i}].name=this.value;saveAll()">` : escapeHtml(item.name)}</td>
              <td><select onchange="changeCostMode(${i}, this.value)" style="width:100px">
                <option value="fixed" ${item.mode === 'fixed' ? 'selected' : ''}>固定单价</option>
                <option value="split" ${item.mode === 'split' ? 'selected' : ''}>总额分摊</option>
              </select></td>
              <td>${item.mode === 'fixed' ? `<input type="number" value="${item.unitCost}" min="0" step="1" style="width:90px" onchange="costItems[${i}].unitCost=+this.value;renderCostTab();saveAll()">` : '<span style="color:#aaa">—</span>'}</td>
              <td>${item.mode === 'split' ? `<input type="number" value="${item.totalAmount}" min="0" step="100" style="width:100px" onchange="costItems[${i}].totalAmount=+this.value;renderCostTab();saveAll()">` : '<span style="color:#aaa">—</span>'}</td>
              <td>${item.mode === 'split' ? `<input type="number" value="${item.monthlyOutput}" min="1" step="10" style="width:90px" onchange="costItems[${i}].monthlyOutput=+this.value;renderCostTab();saveAll()">` : '<span style="color:#aaa">—</span>'}</td>
              <td style="font-weight:700;color:#667eea">${fmt(unitPrice, 2)} 元/吨</td>
              <td>${item.id.startsWith('custom_') ? `<button class="btn btn-danger btn-sm" onclick="removeCostItem(${i})">删除</button>` : ''}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="background:#f0f4ff;font-weight:700">
            <td colspan="7">已启用项合计</td>
            <td style="color:#f7971e;font-size:16px">${fmt(totalExtra, 2)} 元/吨</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <div class="flex-end">
        <button class="btn btn-success" onclick="addCostItem()">+ 添加自定义成本项</button>
      </div>
    </div>`;

  // 只更新内部内容
  const panel = cont.querySelector('.cost-content');
  if (panel) {
    panel.innerHTML = summaryHTML + tableHTML;
  }
}

/** 切换成本项启用状态 */
function toggleCostEnabled(i, checked) {
  costItems[i].enabled = checked;
  renderCostTab();
  saveAll();
}

/** 切换计算模式 */
function changeCostMode(i, mode) {
  costItems[i].mode = mode;
  renderCostTab();
  saveAll();
}

/** 添加自定义成本项 */
function addCostItem() {
  const id = 'custom_' + Date.now();
  costItems.push({
    id,
    name: '新成本项',
    category: 'custom',
    mode: 'fixed',
    unitCost: 0,
    totalAmount: 0,
    monthlyOutput: 500,
    enabled: true
  });
  renderCostTab();
  saveAll();
}

/** 删除成本项 */
function removeCostItem(i) {
  costItems.splice(i, 1);
  renderCostTab();
  saveAll();
}
