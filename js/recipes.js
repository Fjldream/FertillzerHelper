/**
 * recipes.js — 配方库管理
 * 保存、加载、删除、对比配方
 */

console.log('recipes.js loaded');

const RECIPES_KEY = 'feiliao_recipes';

/** 获取所有配方 */
function getRecipes() {
  try {
    const data = localStorage.getItem(RECIPES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/** 保存配方列表 */
function saveRecipes(recipes) {
  localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes));
}

/** 保存当前配方 */
function saveCurrentRecipe() {
  console.log('saveCurrentRecipe called');

  // 判断当前是含量计算还是核价计算
  const activePanel = document.querySelector('.tab-panel.active');
  if (!activePanel) {
    alert('无法识别当前 Tab');
    return;
  }
  const activeTab = activePanel.id.replace('tab-', '');
  console.log('Active tab:', activeTab);

  // 检查是否有求解结果
  if (activeTab === 'formula' && !AppState.lastFormulaResult) {
    alert('请先点击"开始优化求解"完成配方计算');
    return;
  }
  if (activeTab === 'pricing' && !AppState.lastPricingResult) {
    alert('请先点击"自动求解配比"完成核价计算');
    return;
  }
  if (activeTab !== 'formula' && activeTab !== 'pricing') {
    alert('请先切换到"含量计算"或"核价计算" Tab，完成求解后再保存配方');
    return;
  }

  // 用自定义弹窗输入名称
  showRecipeNameDialog(activeTab);
}

/** 显示配方命名弹窗 */
function showRecipeNameDialog(activeTab) {
  const defaultName = '配方 ' + new Date().toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:400px">
      <div class="modal-header">
        <h3>保存配方</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>配方名称</label>
          <input type="text" id="recipe_name_input" value="${defaultName}" autofocus>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-danger" onclick="this.closest('.modal-overlay').remove()">取消</button>
        <button class="btn btn-success" onclick="doSaveRecipe('${activeTab}')">保存</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => {
    const input = document.getElementById('recipe_name_input');
    if (input) { input.focus(); input.select(); }
  }, 100);
}

/** 执行保存配方 */
function doSaveRecipe(activeTab) {
  const nameInput = document.getElementById('recipe_name_input');
  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) {
    alert('请输入配方名称');
    return;
  }

  // 关闭弹窗
  const modal = nameInput.closest('.modal-overlay');
  if (modal) modal.remove();

  try {
    let recipe;

    if (activeTab === 'formula') {
      const cached = AppState.lastFormulaResult;
      if (!cached) { alert('请先完成配方求解'); return; }
      recipe = {
        id: Date.now(),
        name,
        type: 'formula',
        createdAt: new Date().toISOString(),
        params: {
          targetN: +document.getElementById('f_targetN').value,
          targetP: +document.getElementById('f_targetP').value,
          targetK: +document.getElementById('f_targetK').value,
          totalKg: +document.getElementById('f_total').value,
          minNPK: +document.getElementById('f_minNPK').value,
        },
        result: {
          allRaws: cached.allRaws.map(r => ({name: r.name, n: r.n, p: r.p, k: r.k, price: r.price})),
          allPcts: cached.allPcts,
          cost: cached.allPcts.reduce((s, p, i) => s + p * cached.allRaws[i].price, 0),
          actualN: cached.allPcts.reduce((s, p, i) => s + p * cached.allRaws[i].n, 0),
          actualP: cached.allPcts.reduce((s, p, i) => s + p * cached.allRaws[i].p, 0),
          actualK: cached.allPcts.reduce((s, p, i) => s + p * cached.allRaws[i].k, 0),
        }
      };
    } else if (activeTab === 'pricing') {
      const rows = pricingRows.map((row, i) => {
        const sel = document.getElementById('pr' + i + '_sel');
        const rname = sel ? sel.value : row.name;
        const raw = getRaw(rname) || { n: 0, p: 0, k: 0, price: 0 };
        let pct;
        if (row.fixed) {
          const inp = document.getElementById('pr' + i + '_pct');
          pct = (inp ? +inp.value : row.pct) / 100;
        } else {
          pct = row.pct / 100;
        }
        return { raw: {name: raw.name, n: raw.n, p: raw.p, k: raw.k, price: raw.price}, pct };
      });

      const cost = rows.reduce((s, r) => s + r.pct * r.raw.price, 0);
      const extraCost = getTotalExtraCost();

      recipe = {
        id: Date.now(),
        name,
        type: 'pricing',
        createdAt: new Date().toISOString(),
        params: {
          targetN: +document.getElementById('p_targetN').value,
          targetP: +document.getElementById('p_targetP').value,
          targetK: +document.getElementById('p_targetK').value,
          totalKg: +document.getElementById('p_total').value,
        },
        result: {
          allRaws: rows.map(r => r.raw),
          allPcts: rows.map(r => r.pct),
          cost,
          extraCost,
          totalCost: cost + extraCost,
          actualN: rows.reduce((s, r) => s + r.pct * r.raw.n, 0),
          actualP: rows.reduce((s, r) => s + r.pct * r.raw.p, 0),
          actualK: rows.reduce((s, r) => s + r.pct * r.raw.k, 0),
        }
      };
    } else {
      alert('请先切换到"含量计算"或"核价计算" Tab');
      return;
    }

    const recipes = getRecipes();
    recipes.push(recipe);
    saveRecipes(recipes);
    alert('✅ 配方已保存：' + name);
  } catch (error) {
    console.error('Error in doSaveRecipe:', error);
    alert('保存失败：' + error.message);
  }
}

/** 删除配方 */
function deleteRecipe(id) {
  if (!confirm('确定删除该配方？')) return;
  const recipes = getRecipes().filter(r => r.id !== id);
  saveRecipes(recipes);
  renderRecipeTab();
}

/** 加载配方 */
function loadRecipe(id) {
  const recipe = getRecipes().find(r => r.id === id);
  if (!recipe) return;

  if (recipe.type === 'formula') {
    switchTab('formula');
    document.getElementById('f_targetN').value = recipe.params.targetN;
    document.getElementById('f_targetP').value = recipe.params.targetP;
    document.getElementById('f_targetK').value = recipe.params.targetK;
    document.getElementById('f_total').value = recipe.params.totalKg;
    document.getElementById('f_minNPK').value = recipe.params.minNPK;
    alert('配方参数已加载到含量计算 Tab，请点击"开始优化求解"');
  } else {
    switchTab('pricing');
    document.getElementById('p_targetN').value = recipe.params.targetN;
    document.getElementById('p_targetP').value = recipe.params.targetP;
    document.getElementById('p_targetK').value = recipe.params.targetK;
    document.getElementById('p_total').value = recipe.params.totalKg;
    alert('配方参数已加载到核价计算 Tab');
  }
}

/** 渲染配方库 Tab */
function renderRecipeTab() {
  const recipes = getRecipes();
  const panel = document.getElementById('tab-recipes');
  if (!panel) return;

  if (recipes.length === 0) {
    panel.innerHTML = `
      <div class="section">
        <div class="alert alert-info">
          配方库为空。请在"含量计算"或"核价计算"完成求解后，点击"💾 保存当前配方"按钮。
        </div>
      </div>
    `;
    return;
  }

  panel.innerHTML = `
    <div class="section">
      <div class="section-title">配方列表</div>
      <table>
        <thead>
          <tr>
            <th>配方名称</th>
            <th>类型</th>
            <th>目标配比</th>
            <th>成本（元/吨）</th>
            <th>保存时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${recipes.map(r => `
            <tr>
              <td><b>${escapeHtml(r.name)}</b></td>
              <td><span class="badge ${r.type === 'formula' ? 'badge-ok' : 'badge-warn'}">${r.type === 'formula' ? '含量计算' : '核价计算'}</span></td>
              <td>${r.params.targetN}-${r.params.targetP}-${r.params.targetK}</td>
              <td>${fmt(r.result.cost, 2)}</td>
              <td>${new Date(r.createdAt).toLocaleString('zh-CN')}</td>
              <td>
                <button class="btn btn-sm" onclick="loadRecipe(${r.id})">加载</button>
                <button class="btn btn-danger btn-sm" onclick="deleteRecipe(${r.id})">删除</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">配方对比</div>
      <div class="alert alert-info">选择两个配方进行对比分析</div>
      <div class="form-row cols-3">
        <div class="form-group">
          <label>配方 A</label>
          <select id="compare_a">
            <option value="">请选择</option>
            ${recipes.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>配方 B</label>
          <select id="compare_b">
            <option value="">请选择</option>
            ${recipes.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="align-self:flex-end">
          <button class="btn btn-success" onclick="compareRecipes()" style="width:100%">开始对比</button>
        </div>
      </div>
      <div id="compare_result"></div>
    </div>
  `;
}

/** 对比两个配方 */
function compareRecipes() {
  const idA = +document.getElementById('compare_a').value;
  const idB = +document.getElementById('compare_b').value;
  if (!idA || !idB) {
    alert('请选择两个配方');
    return;
  }
  if (idA === idB) {
    alert('请选择不同的配方');
    return;
  }

  const recipes = getRecipes();
  const recipeA = recipes.find(r => r.id === idA);
  const recipeB = recipes.find(r => r.id === idB);

  const resultDiv = document.getElementById('compare_result');
  resultDiv.innerHTML = `
    <div class="divider"></div>
    <table>
      <thead>
        <tr>
          <th>对比项</th>
          <th>${escapeHtml(recipeA.name)}</th>
          <th>${escapeHtml(recipeB.name)}</th>
          <th>差异</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>类型</td>
          <td>${recipeA.type === 'formula' ? '含量计算' : '核价计算'}</td>
          <td>${recipeB.type === 'formula' ? '含量计算' : '核价计算'}</td>
          <td>—</td>
        </tr>
        <tr>
          <td>目标配比</td>
          <td>${recipeA.params.targetN}-${recipeA.params.targetP}-${recipeA.params.targetK}</td>
          <td>${recipeB.params.targetN}-${recipeB.params.targetP}-${recipeB.params.targetK}</td>
          <td>—</td>
        </tr>
        <tr style="background:#f8f9ff">
          <td><b>实际氮 N (%)</b></td>
          <td>${fmt(recipeA.result.actualN, 2)}%</td>
          <td>${fmt(recipeB.result.actualN, 2)}%</td>
          <td style="color:${recipeA.result.actualN > recipeB.result.actualN ? '#11998e' : '#f5576c'}">${fmt(recipeA.result.actualN - recipeB.result.actualN, 2)}%</td>
        </tr>
        <tr style="background:#f8f9ff">
          <td><b>实际磷 P (%)</b></td>
          <td>${fmt(recipeA.result.actualP, 2)}%</td>
          <td>${fmt(recipeB.result.actualP, 2)}%</td>
          <td style="color:${recipeA.result.actualP > recipeB.result.actualP ? '#11998e' : '#f5576c'}">${fmt(recipeA.result.actualP - recipeB.result.actualP, 2)}%</td>
        </tr>
        <tr style="background:#f8f9ff">
          <td><b>实际钾 K (%)</b></td>
          <td>${fmt(recipeA.result.actualK, 2)}%</td>
          <td>${fmt(recipeB.result.actualK, 2)}%</td>
          <td style="color:${recipeA.result.actualK > recipeB.result.actualK ? '#11998e' : '#f5576c'}">${fmt(recipeA.result.actualK - recipeB.result.actualK, 2)}%</td>
        </tr>
        <tr style="background:#fffbf0">
          <td><b>裸料成本（元/吨）</b></td>
          <td>${fmt(recipeA.result.cost, 2)}</td>
          <td>${fmt(recipeB.result.cost, 2)}</td>
          <td style="color:${recipeA.result.cost < recipeB.result.cost ? '#11998e' : '#f5576c'};font-weight:700">${fmt(recipeA.result.cost - recipeB.result.cost, 2)}</td>
        </tr>
      </tbody>
    </table>
  `;
}

