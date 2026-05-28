/**
 * formula.js — 含量计算（配方优化）模块
 * 可变原料行、固定辅料行、LP 求解
 */

/** 渲染可变原料行（最多8种） */
function renderFormulaRows() {
  // 直接清理掉引用已删除原料的行
  sanitizeAllRows();
  const cont = document.getElementById('f_rows');
  cont.innerHTML = `
    <table>
      <thead><tr><th>原料</th><th>养分配比</th><th>氮 N (%)</th><th>磷 P (%)</th><th>钾 K (%)</th><th>价格（元/吨）</th><th>操作</th></tr></thead>
      <tbody>
        ${formulaRows.map((row, i) => {
          const raw = getRaw(row.name) || { n: 0, p: 0, k: 0, price: 0 };
          return `<tr>
            <td>${buildSelect('fr' + i + '_sel', row.name)}</td>
            <td><span id="fr${i}_formula" class="tag">${raw.n}-${raw.p}-${raw.k}</span></td>
            <td id="fr${i}_n">${fmt(raw.n, 1)}%</td>
            <td id="fr${i}_p">${fmt(raw.p, 1)}%</td>
            <td id="fr${i}_k">${fmt(raw.k, 1)}%</td>
            <td id="fr${i}_price">${raw.price.toLocaleString()}元/吨</td>
            <td><button class="btn btn-danger btn-sm" onclick="removeFormulaRow(${i})">移除</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function addFormulaRow() {
  if (formulaRows.length >= 8) { alert('最多添加8种原料'); return; }
  formulaRows.push({ name: getDefaultRawName() });
  renderFormulaRows();
  saveAll();
}

function removeFormulaRow(i) {
  formulaRows.splice(i, 1);
  renderFormulaRows();
  saveAll();
}

/** 渲染固定辅料行 */
function renderFixedRows() {
  // 直接清理掉引用已删除原料的行
  sanitizeAllRows();
  const cont = document.getElementById('f_fixed_rows');
  cont.innerHTML = `
    <table>
      <thead><tr><th>原料</th><th>养分配比</th><th>固定百分比 (%)</th><th>用量 (kg/吨)</th><th>操作</th></tr></thead>
      <tbody>
        ${fixedRows.map((row, i) => {
          const raw = getRaw(row.name) || { n: 0, p: 0, k: 0, price: 0 };
          const kg = (row.pct / 100 * 1000).toFixed(2);
          return `<tr>
            <td>${buildSelect('fx' + i + '_sel', row.name)}</td>
            <td><span class="tag">${raw.n}-${raw.p}-${raw.k}</span></td>
            <td><input type="number" value="${row.pct}" step="0.01" min="0" max="100" style="width:100px" onchange="fixedRows[${i}].pct=+this.value;saveAll()"></td>
            <td>${kg} kg</td>
            <td><button class="btn btn-danger btn-sm" onclick="removeFixedRow(${i})">移除</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function addFixedRow() {
  fixedRows.push({ name: getDefaultRawName(), pct: 1 });
  renderFixedRows();
  saveAll();
}

function removeFixedRow(i) {
  fixedRows.splice(i, 1);
  renderFixedRows();
  saveAll();
}

/** 含量计算求解（LP 优化） */
function solveFormula() {
  // 读取当前选择的原料
  const selMats = formulaRows.map((row, i) => {
    const sel = document.getElementById('fr' + i + '_sel');
    const name = sel ? sel.value : row.name;
    return getRaw(name);
  }).filter(Boolean);

  const selFixed = fixedRows.map((row, i) => {
    const sel = document.getElementById('fx' + i + '_sel');
    const name = sel ? sel.value : row.name;
    const pct = fixedRows[i].pct / 100;
    return { raw: getRaw(name), pct };
  }).filter(f => f.raw);

  const targetN = +document.getElementById('f_targetN').value;
  const targetP = +document.getElementById('f_targetP').value;
  const targetK = +document.getElementById('f_targetK').value;
  const totalKg = +document.getElementById('f_total').value;
  const minNPK  = +document.getElementById('f_minNPK').value;

  // 固定辅料占比之和
  const fixedSum = selFixed.reduce((s, f) => s + f.pct, 0);
  if (fixedSum >= 1) { alert('固定辅料百分比之和已超过100%，请调整'); return; }

  // 固定辅料贡献的养分
  const fixedN = selFixed.reduce((s, f) => s + f.pct * f.raw.n, 0);
  const fixedP = selFixed.reduce((s, f) => s + f.pct * f.raw.p, 0);
  const fixedK = selFixed.reduce((s, f) => s + f.pct * f.raw.k, 0);

  // 可变原料需要满足的养分目标
  const remPct = 1 - fixedSum;
  const needN  = targetN - fixedN;
  const needP  = targetP - fixedP;
  const needK  = targetK - fixedK;

  const n = selMats.length;
  if (n === 0) { alert('请至少选择一种可变原料'); return; }

  // 目标函数：最小化成本
  const c = selMats.map(r => r.price);

  // 等式约束：养分平衡 + 百分比和（与 V1 一致）
  const A_eq = [
    selMats.map(r => r.n),
    selMats.map(r => r.p),
    selMats.map(r => r.k),
    selMats.map(() => 1),
  ];
  const b_eq = [needN, needP, needK, remPct];

  const fixedNPK = fixedN + fixedP + fixedK;

  // 多级回退求解（与 V1 一致的 4 参数 simplex 调用）
  let x = simplex(c, A_eq, b_eq, null);
  let relaxed = false;

  if (!x || x.some(v => v < -0.001)) {
    // 第1次回退：允许养分不达标，用高惩罚系数保证尽可能接近目标
    const M = 100000;
    const aug_c = [...c, M, M, M];
    const aug_A = [
      [...selMats.map(r => r.n), 1, 0, 0],
      [...selMats.map(r => r.p), 0, 1, 0],
      [...selMats.map(r => r.k), 0, 0, 1],
      [...selMats.map(() => 1), 0, 0, 0],
    ];
    const aug_b = [needN, needP, needK, remPct];
    const x_aug = simplex(aug_c, aug_A, aug_b, null);
    if (x_aug) {
      x = x_aug.slice(0, n);
    }
    relaxed = true;
  }

  if (!x || x.some(v => v < -0.001)) {
    // 第2次回退：仅满足百分比和为1，尽可能降低成本
    const simple_A = [selMats.map(() => 1)];
    const simple_b = [remPct];
    x = simplex(c, simple_A, simple_b, null);
    relaxed = true;
  }

  // 修正负值（数值误差）
  x.forEach((v, i) => { if (v < 0) x[i] = 0; });

  // 计算实际养分
  const allPcts = [...x, ...selFixed.map(f => f.pct)];
  const allRaws = [...selMats, ...selFixed.map(f => f.raw)];

  // 缓存求解结果
  AppState.lastFormulaResult = { selMats, selFixed, x, allPcts, allRaws, totalKg, targetN, targetP, targetK, minNPK, relaxed };
  const actualN = allPcts.reduce((s, p, i) => s + p * allRaws[i].n, 0);
  const actualP = allPcts.reduce((s, p, i) => s + p * allRaws[i].p, 0);
  const actualK = allPcts.reduce((s, p, i) => s + p * allRaws[i].k, 0);
  const actualNPK = actualN + actualP + actualK;

  // 计算成本（元/吨）
  const cost = allPcts.reduce((s, p, i) => s + p * allRaws[i].price, 0);

  // 渲染结果
  let rows = selMats.map((r, i) => `
    <tr>
      <td>${escapeHtml(r.name)}</td>
      <td><span class="tag">${r.n}-${r.p}-${r.k}</span></td>
      <td>${fmt(x[i] * 100, 4)}%</td>
      <td>${fmt(x[i] * totalKg, 2)} kg</td>
      <td>${r.price.toLocaleString()} 元/吨</td>
      <td>${fmt(x[i] * r.price, 2)} 元</td>
    </tr>`).join('');

  rows += selFixed.map(f => `
    <tr style="background:#fffbf0">
      <td>${escapeHtml(f.raw.name)} <span class="badge badge-warn">固定</span></td>
      <td><span class="tag">${f.raw.n}-${f.raw.p}-${f.raw.k}</span></td>
      <td>${fmt(f.pct * 100, 4)}%</td>
      <td>${fmt(f.pct * totalKg, 2)} kg</td>
      <td>${f.raw.price.toLocaleString()} 元/吨</td>
      <td>${fmt(f.pct * f.raw.price, 2)} 元</td>
    </tr>`).join('');

  const npkOk = actualNPK >= minNPK;
  const estimatedPh = estimatePH(allRaws, allPcts);
  const phStatus = getPHStatus(estimatedPh);
  document.getElementById('f_result').style.display = 'block';
  document.getElementById('f_result_content').innerHTML = `
    ${relaxed ? `<div class="alert alert-warn" style="margin-bottom:12px">无法精确匹配目标养分，以下为最接近的近似解。</div>` : ''}
    <div class="result-grid">
      <div class="result-card"><div class="val">${fmt(actualN, 2)}%</div><div class="lbl">实际氮 N（目标${targetN}%）</div></div>
      <div class="result-card"><div class="val">${fmt(actualP, 2)}%</div><div class="lbl">实际磷 P（目标${targetP}%）</div></div>
      <div class="result-card"><div class="val">${fmt(actualK, 2)}%</div><div class="lbl">实际钾 K（目标${targetK}%）</div></div>
      <div class="result-card ${npkOk ? 'green' : 'red'}"><div class="val">${fmt(actualNPK, 2)}%</div><div class="lbl">总养分 NPK（下限${minNPK}%）</div></div>
      <div class="result-card" style="background:linear-gradient(135deg,${phStatus.color},${phStatus.color}88)"><div class="val">${fmt(estimatedPh, 1)}</div><div class="lbl">预估pH <span class="badge ${phStatus.cls}">${phStatus.text}</span></div></div>
      <div class="result-card orange"><div class="val">${fmt(cost, 0)}元</div><div class="lbl">裸料成本（元/吨）</div></div>
      <div class="result-card green"><div class="val">${fmt(allPcts.reduce((s, p) => s + p, 0) * totalKg, 2)} kg</div><div class="lbl">总质量（设定值 ${totalKg} kg）</div></div>
    </div>
    <div class="divider"></div>
    <div style="text-align:center;margin-bottom:16px;display:flex;gap:10px;justify-content:center">
      <button class="btn btn-success" onclick="openFormulaDetailReport()">📊 查看详细报告（含微量元素）</button>
      <button class="btn" onclick="openSensitivityAnalysis()" style="background:linear-gradient(135deg,#f093fb,#f5576c)">📈 价格敏感度分析</button>
      <button class="btn" onclick="exportFormulaToExcel()" style="background:linear-gradient(135deg,#06b6d4,#3b82f6)">📥 导出 Excel 报告</button>
    </div>
    <table>
      <thead><tr><th>原料</th><th>养分配比</th><th>百分比</th><th>用量（${totalKg}kg）</th><th>原料价格</th><th>分摊成本</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f0f4ff;font-weight:700">
          <td colspan="2">合计</td>
          <td>${fmt(allPcts.reduce((s, p) => s + p, 0) * 100, 2)}%</td>
          <td>${fmt(allPcts.reduce((s, p) => s + p, 0) * totalKg, 2)} kg</td>
          <td>—</td>
          <td>${fmt(cost, 2)} 元/吨</td>
        </tr>
      </tfoot>
    </table>`;
}
