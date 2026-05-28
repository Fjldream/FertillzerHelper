/**
 * pricing.js — 核价计算模块
 * 原料行（固定/可变）、自动求解、实时计算
 */

/** 渲染核价原料行 */
function renderPricingRows() {
  // 重绘前先把页面上当前选择同步回状态，避免重绘导致选项回退（如回到“尿素”）
  syncPricingRowsFromDOM();
  // 直接清理掉引用已删除原料的行
  sanitizeAllRows();
  const cont = document.getElementById('p_rows');
  cont.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>原料</th><th>养分配比</th><th>氮 N (%)</th><th>磷 P (%)</th><th>钾 K (%)</th>
          <th>价格（元/吨）</th>
          <th>固定辅料</th>
          <th>百分比 (%)<br><small style="font-weight:400;opacity:.8">固定辅料手动填，可变原料自动求解</small></th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${pricingRows.map((row, i) => {
          const raw = getRaw(row.name) || { n: 0, p: 0, k: 0, price: 0 };
          return `<tr id="prow_${i}" style="${row.fixed ? 'background:#fffbf0' : ''}">
            <td>${buildSelect('pr' + i + '_sel', row.name)}</td>
            <td><span id="pr${i}_formula" class="tag">${raw.n}-${raw.p}-${raw.k}</span></td>
            <td id="pr${i}_n">${fmt(raw.n, 1)}%</td>
            <td id="pr${i}_p">${fmt(raw.p, 1)}%</td>
            <td id="pr${i}_k">${fmt(raw.k, 1)}%</td>
            <td id="pr${i}_price">${raw.price.toLocaleString()}元/吨</td>
            <td style="text-align:center">
              <input type="checkbox" ${row.fixed ? 'checked' : ''} onchange="togglePricingFixed(${i}, this.checked)" style="width:auto;transform:scale(1.3)">
            </td>
            <td>
              ${row.fixed
                ? `<input type="number" id="pr${i}_pct" value="${row.pct}" step="0.0001" min="0" max="100" style="width:110px" onchange="pricingRows[${i}].pct=+this.value;calcPricing();saveAll()">`
                : `<span id="pr${i}_pct_display" style="font-weight:600;color:#667eea">${row.pct > 0 ? fmt(row.pct, 4) + '%' : '—（待求解）'}</span>`
              }
            </td>
            <td><button class="btn btn-danger btn-sm" onclick="removePricingRow(${i})">移除</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  calcPricing();
}

/** 将当前页面上的选择/输入同步回 pricingRows，供重绘使用 */
function syncPricingRowsFromDOM() {
  // 如果 tab 未渲染或正在首次渲染，DOM 可能不存在，直接跳过
  for (let i = 0; i < pricingRows.length; i++) {
    const sel = document.getElementById('pr' + i + '_sel');
    if (sel) pricingRows[i].name = sel.value;

    // 固定辅料的百分比来自 input
    const pctInp = document.getElementById('pr' + i + '_pct');
    if (pctInp && pricingRows[i].fixed) pricingRows[i].pct = +pctInp.value;
  }
}

function togglePricingFixed(i, checked) {
  syncPricingRowsFromDOM();
  pricingRows[i].fixed = checked;
  renderPricingRows();
  saveAll();
}

function addPricingRow() {
  pricingRows.push({ name: getDefaultRawName(), fixed: false, pct: 0 });
  renderPricingRows();
  saveAll();
}

function removePricingRow(i) {
  pricingRows.splice(i, 1);
  renderPricingRows();
  saveAll();
}

/** 自动求解核价配比（LP 优化） */
function solvePricing() {
  // 读取当前选择的原料名称
  pricingRows.forEach((row, i) => {
    const sel = document.getElementById('pr' + i + '_sel');
    if (sel) row.name = sel.value;
  });

  const varRows    = pricingRows.filter(r => !r.fixed);
  const fixedRowsP = pricingRows.filter(r => r.fixed);

  const selMats  = varRows.map(r => getRaw(r.name)).filter(Boolean);
  const selFixed = fixedRowsP.map(r => ({ raw: getRaw(r.name), pct: r.pct / 100 })).filter(f => f.raw);

  const targetN = +document.getElementById('p_targetN').value;
  const targetP = +document.getElementById('p_targetP').value;
  const targetK = +document.getElementById('p_targetK').value;

  const fixedSum = selFixed.reduce((s, f) => s + f.pct, 0);
  if (fixedSum >= 1) { alert('固定辅料百分比之和已超过100%，请调整'); return; }

  const fixedN = selFixed.reduce((s, f) => s + f.pct * f.raw.n, 0);
  const fixedP = selFixed.reduce((s, f) => s + f.pct * f.raw.p, 0);
  const fixedK = selFixed.reduce((s, f) => s + f.pct * f.raw.k, 0);

  const remPct = 1 - fixedSum;
  const needN  = targetN - fixedN;
  const needP  = targetP - fixedP;
  const needK  = targetK - fixedK;

  const n = selMats.length;
  if (n === 0) { alert('请至少选择一种可变原料（非固定辅料）'); return; }

  const c    = selMats.map(r => r.price);
  const A_eq = [selMats.map(r => r.n), selMats.map(r => r.p), selMats.map(r => r.k), selMats.map(() => 1)];
  const b_eq = [needN, needP, needK, remPct];

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
    // 第2次回退：仅满足百分比和为1
    const simple_A = [selMats.map(() => 1)];
    const simple_b = [remPct];
    x = simplex(c, simple_A, simple_b, null);
    relaxed = true;
  }

  x.forEach((v, i) => { if (v < 0) x[i] = 0; });

  // 将求解结果写回 pricingRows
  let vi = 0;
  pricingRows.forEach(row => {
    if (!row.fixed) { row.pct = x[vi++] * 100; }
  });

  AppState._pricingRelaxed = relaxed;
  renderPricingRows();
  calcPricing();
  saveAll();
}

/** 实时计算核价结果（根据当前百分比） */
function calcPricing() {
  // 读取当前选择的原料名称和百分比
  const rows = pricingRows.map((row, i) => {
    const sel = document.getElementById('pr' + i + '_sel');
    const name = sel ? sel.value : row.name;
    const raw = getRaw(name) || { n: 0, p: 0, k: 0, price: 0 };

    // 固定辅料从 input 读，可变原料从 row.pct 读
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

  const totalPct  = rows.reduce((s, r) => s + r.pct, 0);
  const actualN   = rows.reduce((s, r) => s + r.pct * r.raw.n, 0);
  const actualP   = rows.reduce((s, r) => s + r.pct * r.raw.p, 0);
  const actualK   = rows.reduce((s, r) => s + r.pct * r.raw.k, 0);
  const actualNPK = actualN + actualP + actualK;

  // 核心成本公式：裸料成本(元/吨) = Σ(百分比i × 价格i)
  const cost = rows.reduce((s, r) => s + r.pct * r.raw.price, 0);
  // 附加成本（来自成本管理模块）
  const extraCost = getTotalExtraCost();
  const totalCost = cost + extraCost;

  // 缓存核价结果（用于配方保存和敏感度分析）
  const allRaws = rows.map(r => r.raw);
  const allPcts = rows.map(r => r.pct);
  AppState.lastPricingResult = { allRaws, allPcts, cost, extraCost, totalCost, actualN, actualP, actualK };

  const totalMass = rows.reduce((s, r) => s + r.pct * totalKg, 0);
  const massOk = Math.abs(totalMass - totalKg) < 0.1;
  const pctOk  = Math.abs(totalPct - 1) < 0.001;
  const nOk    = Math.abs(actualN - targetN) < 0.1;
  const pOk    = Math.abs(actualP - targetP) < 0.1;
  const kOk    = Math.abs(actualK - targetK) < 0.1;
  const estimatedPh = estimatePH(allRaws, allPcts);
  const phStatus = getPHStatus(estimatedPh);

  function statusBadge(ok, val, target) {
    const diff = val - target;
    const cls = ok ? 'badge-ok' : (Math.abs(diff) < 1 ? 'badge-warn' : 'badge-err');
    const sign = diff >= 0 ? '+' : '';
    return `<span class="badge ${cls}">${ok ? '达标' : '偏差' + sign + fmt(diff, 2) + '%'}</span>`;
  }

  let detailRows = rows.map(r => `
    <tr style="${r.fixed ? 'background:#fffbf0' : ''}">
      <td>${escapeHtml(r.name)}${r.fixed ? '<span class="badge badge-warn" style="margin-left:4px">固定</span>' : ''}</td>
      <td><span class="tag">${r.raw.n}-${r.raw.p}-${r.raw.k}</span></td>
      <td>${fmt(r.pct * 100, 4)}%</td>
      <td>${fmt(r.pct * totalKg, 2)} kg</td>
      <td>${r.raw.price.toLocaleString()} 元/吨</td>
      <td><b>${fmt(r.pct * r.raw.price, 2)}</b> 元</td>
      <td>${fmt(r.pct * r.raw.n, 2)}%</td>
      <td>${fmt(r.pct * r.raw.p, 2)}%</td>
      <td>${fmt(r.pct * r.raw.k, 2)}%</td>
    </tr>`).join('');

  // 触发利润计算
  setTimeout(() => calcProfit(), 100);

  const relaxed = AppState._pricingRelaxed;
  document.getElementById('p_result_content').innerHTML = `
    ${relaxed ? `<div class="alert alert-warn" style="margin-bottom:12px">无法精确匹配目标养分，以下为最接近的近似解。</div>` : ''}
    <div class="result-grid">
      <div class="result-card ${nOk ? 'green' : 'red'}"><div class="val">${fmt(actualN, 2)}%</div><div class="lbl">实际氮 N（目标${targetN}%）</div></div>
      <div class="result-card ${pOk ? 'green' : 'red'}"><div class="val">${fmt(actualP, 2)}%</div><div class="lbl">实际磷 P（目标${targetP}%）</div></div>
      <div class="result-card ${kOk ? 'green' : 'red'}"><div class="val">${fmt(actualK, 2)}%</div><div class="lbl">实际钾 K（目标${targetK}%）</div></div>
      <div class="result-card"><div class="val">${fmt(actualNPK, 2)}%</div><div class="lbl">总养分 NPK</div></div>
      <div class="result-card" style="background:linear-gradient(135deg,${phStatus.color},${phStatus.color}88)"><div class="val">${fmt(estimatedPh, 1)}</div><div class="lbl">预估pH <span class="badge ${phStatus.cls}">${phStatus.text}</span></div></div>
      <div class="result-card orange"><div class="val">${fmt(cost, 2)}</div><div class="lbl">裸料成本（元/吨）</div></div>
      <div class="result-card" style="background:linear-gradient(135deg,#06b6d4,#3b82f6)"><div class="val">${fmt(extraCost, 2)}</div><div class="lbl">附加成本（元/吨）</div></div>
      <div class="result-card" style="background:linear-gradient(135deg,#dc2626,#991b1b)"><div class="val">${fmt(totalCost, 2)}</div><div class="lbl">生产总成本（元/吨）</div></div>
      <div class="result-card ${massOk ? 'green' : 'red'}"><div class="val">${fmt(totalMass, 2)} kg</div><div class="lbl">总质量（设定值 ${totalKg} kg）</div></div>
    </div>
    <div class="divider"></div>
    <div style="text-align:center;margin-bottom:16px;display:flex;gap:10px;justify-content:center">
      <button class="btn btn-success" onclick="openPricingDetailReport()">📊 查看详细报告（含微量元素）</button>
      <button class="btn" onclick="openSensitivityAnalysis()" style="background:linear-gradient(135deg,#f093fb,#f5576c)">📈 价格敏感度分析</button>
      <button class="btn" onclick="exportPricingToExcel()" style="background:linear-gradient(135deg,#06b6d4,#3b82f6)">📥 导出 Excel 报告</button>
    </div>

    <!-- 利润报价模块 -->
    <div class="profit-section">
      <div class="section-title">💰 利润核算 & 报价</div>
      <div class="form-row cols-4">
        <div class="form-group">
          <label>目标利润率 (%)</label>
          <input type="number" id="profit_rate" value="15" min="0" max="100" step="1" onchange="calcProfit()">
        </div>
        <div class="form-group">
          <label>或直接设定售价（元/吨）</label>
          <input type="number" id="profit_price" value="" min="0" step="10" onchange="calcProfitFromPrice()">
        </div>
        <div class="form-group">
          <label>运费（元/吨）</label>
          <input type="number" id="profit_freight" value="0" min="0" step="10" onchange="calcProfit()">
        </div>
        <div class="form-group">
          <label>含税 <small>(增值税13%)</small></label>
          <select id="profit_tax" onchange="calcProfit()">
            <option value="0">不含税</option>
            <option value="13">含税（13%）</option>
            <option value="9">含税（9%）</option>
          </select>
        </div>
      </div>
      <div id="profit_result"></div>
      <div class="divider"></div>
      <div class="section-title">📦 包装规格利润</div>
      <div class="form-row cols-4">
        <div class="form-group"><label>规格1 (kg)</label><input type="number" id="pack1" value="5" min="0" step="1" onchange="calcProfit()"></div>
        <div class="form-group"><label>规格2 (kg)</label><input type="number" id="pack2" value="10" min="0" step="1" onchange="calcProfit()"></div>
        <div class="form-group"><label>规格3 (kg)</label><input type="number" id="pack3" value="25" min="0" step="1" onchange="calcProfit()"></div>
        <div class="form-group"><label>规格4 (kg)</label><input type="number" id="pack4" value="40" min="0" step="1" onchange="calcProfit()"></div>
      </div>
      <div id="pack_result"></div>
      <div class="divider"></div>
      <div id="product_type_result"></div>
    </div>

    <div class="divider"></div>
    <div style="margin-bottom:10px;display:flex;gap:10px;flex-wrap:wrap">
      <span>氮：${statusBadge(nOk, actualN, targetN)}</span>
      <span>磷：${statusBadge(pOk, actualP, targetP)}</span>
      <span>钾：${statusBadge(kOk, actualK, targetK)}</span>
      <span>百分比合计：<span class="badge ${pctOk ? 'badge-ok' : 'badge-err'}">${pctOk ? '100%' : fmt(totalPct * 100, 4) + '%'}</span></span>
      <span>总质量：<span class="badge ${massOk ? 'badge-ok' : 'badge-err'}">${massOk ? fmt(totalMass, 2) + 'kg ✓' : fmt(totalMass, 2) + 'kg（应为' + totalKg + 'kg）'}</span></span>
    </div>
    <table>
      <thead><tr><th>原料</th><th>养分配比</th><th>百分比</th><th>用量（${totalKg}kg）</th><th>原料价格</th><th>分摊成本</th><th>贡献氮</th><th>贡献磷</th><th>贡献钾</th></tr></thead>
      <tbody>${detailRows}</tbody>
      <tfoot>
        <tr style="background:#f0f4ff;font-weight:700">
          <td colspan="2">合计</td>
          <td>${fmt(totalPct * 100, 2)}%</td>
          <td>${fmt(totalPct * totalKg, 2)} kg</td>
          <td>—</td>
          <td>${fmt(cost, 2)} 元/吨</td>
          <td>${fmt(actualN, 2)}%</td>
          <td>${fmt(actualP, 2)}%</td>
          <td>${fmt(actualK, 2)}%</td>
        </tr>
      </tfoot>
    </table>
    <div class="alert alert-info" style="margin-top:16px">
      <b>成本计算公式：</b><br>
      裸料成本 = Σ（原料百分比 × 原料价格）= ${rows.map(r => `${fmt(r.pct * 100, 2)}%×${r.raw.price}`).join(' + ')} = <b>${fmt(cost, 2)} 元/吨</b><br>
      附加成本（电费+包材+人工等）= <b>${fmt(extraCost, 2)} 元/吨</b><br>
      <span style="font-size:15px;color:#dc2626"><b>生产总成本 = ${fmt(cost, 2)} + ${fmt(extraCost, 2)} = ${fmt(totalCost, 2)} 元/吨</b></span>
    </div>`;
}

/** 根据利润率计算售价 */
function calcProfit() {
  const rows = pricingRows.map((row, i) => {
    const sel = document.getElementById('pr' + i + '_sel');
    const name = sel ? sel.value : row.name;
    const raw = getRaw(name) || { n: 0, p: 0, k: 0, price: 0, cl: 0 };
    let pct;
    if (row.fixed) {
      const inp = document.getElementById('pr' + i + '_pct');
      pct = (inp ? +inp.value : row.pct) / 100;
    } else {
      pct = row.pct / 100;
    }
    return { raw, pct };
  });

  const cost = rows.reduce((s, r) => s + r.pct * r.raw.price, 0);
  const extraCost = getTotalExtraCost();
  const freight = +document.getElementById('profit_freight').value || 0;
  const taxRate = +document.getElementById('profit_tax').value || 0;
  const totalCost = cost + extraCost + freight;

  const profitRate = +document.getElementById('profit_rate').value || 0;
  const salePriceBeforeTax = totalCost / (1 - profitRate / 100);
  const taxAmount = salePriceBeforeTax * taxRate / 100;
  const salePrice = salePriceBeforeTax + taxAmount;
  const profitPerTon = salePriceBeforeTax - totalCost;

  document.getElementById('profit_price').value = Math.round(salePrice);

  document.getElementById('profit_result').innerHTML = `
    <div class="result-grid" style="margin-top:16px">
      <div class="result-card orange"><div class="val">${fmt(totalCost, 2)}</div><div class="lbl">完全成本（含运费）</div></div>
      <div class="result-card" style="background:linear-gradient(135deg,#f093fb,#f5576c)"><div class="val">${profitRate}%</div><div class="lbl">目标利润率</div></div>
      <div class="result-card" style="background:linear-gradient(135deg,#11998e,#38ef7d)"><div class="val">${fmt(salePrice, 2)}</div><div class="lbl">${taxRate > 0 ? '含税售价' : '建议售价'}（元/吨）</div></div>
      <div class="result-card" style="background:linear-gradient(135deg,#667eea,#764ba2)"><div class="val">${fmt(profitPerTon, 2)}</div><div class="lbl">吨利润（元）</div></div>
    </div>
    ${taxRate > 0 ? `<div class="alert alert-info" style="margin-top:12px;font-size:12px">不含税价 ${fmt(salePriceBeforeTax, 2)} + 增值税(${taxRate}%) ${fmt(taxAmount, 2)} = 含税价 ${fmt(salePrice, 2)} 元/吨</div>` : ''}
  `;

  // 包装规格利润
  const packs = [
    +document.getElementById('pack1').value || 0,
    +document.getElementById('pack2').value || 0,
    +document.getElementById('pack3').value || 0,
    +document.getElementById('pack4').value || 0,
  ].filter(p => p > 0);

  if (packs.length > 0) {
    document.getElementById('pack_result').innerHTML = `
      <table style="margin-top:16px">
        <thead><tr><th>包装规格</th><th>每袋成本（元）</th><th>每袋售价（元）</th><th>每袋利润（元）</th></tr></thead>
        <tbody>
          ${packs.map(kg => `
            <tr>
              <td><b>${kg} kg</b></td>
              <td>${fmt(totalCost * kg / 1000, 2)}</td>
              <td style="color:#11998e;font-weight:700">${fmt(salePrice * kg / 1000, 2)}</td>
              <td style="color:#667eea;font-weight:700">${fmt(profitPerTon * kg / 1000, 2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // 产品类型判定
  const actualN = rows.reduce((s, r) => s + r.pct * r.raw.n, 0);
  const actualP = rows.reduce((s, r) => s + r.pct * r.raw.p, 0);
  const actualK = rows.reduce((s, r) => s + r.pct * r.raw.k, 0);
  const actualCl = rows.reduce((s, r) => s + r.pct * (r.raw.cl || 0), 0);
  const allRaws = rows.map(r => r.raw);
  const allPcts = rows.map(r => r.pct);
  const traceResults = calculateAllTraceElements(allRaws, allPcts);
  const product = judgeProductType(actualN, actualP, actualK, actualCl, traceResults);

  document.getElementById('product_type_result').innerHTML = `
    <div class="section-title">📋 产品类型判定</div>
    <div class="result-grid">
      <div class="result-card" style="background:linear-gradient(135deg,#667eea,#764ba2)"><div class="val" style="font-size:16px">${product.type}</div><div class="lbl">产品类型</div></div>
      <div class="result-card"><div class="val" style="font-size:16px">${product.standard}</div><div class="lbl">执行标准</div></div>
      <div class="result-card"><div class="val">${product.clType}</div><div class="lbl">氯含量分类</div></div>
      <div class="result-card"><div class="val">${product.totalNPK}%</div><div class="lbl">N+P+K</div></div>
    </div>
    ${product.note ? `<div class="alert alert-info" style="margin-top:12px;font-size:12px">📌 判定依据：${product.note}</div>` : ''}
  `;
}

/** 根据售价反算利润率 */
function calcProfitFromPrice() {
  const rows = pricingRows.map((row, i) => {
    const sel = document.getElementById('pr' + i + '_sel');
    const name = sel ? sel.value : row.name;
    const raw = getRaw(name) || { n: 0, p: 0, k: 0, price: 0 };
    let pct;
    if (row.fixed) {
      const inp = document.getElementById('pr' + i + '_pct');
      pct = (inp ? +inp.value : row.pct) / 100;
    } else {
      pct = row.pct / 100;
    }
    return { raw, pct };
  });

  const cost = rows.reduce((s, r) => s + r.pct * r.raw.price, 0);
  const extraCost = getTotalExtraCost();
  const freight = +document.getElementById('profit_freight').value || 0;
  const taxRate = +document.getElementById('profit_tax').value || 0;
  const totalCost = cost + extraCost + freight;

  let salePrice = +document.getElementById('profit_price').value || 0;
  // 如果含税，先去税
  const salePriceBeforeTax = taxRate > 0 ? salePrice / (1 + taxRate / 100) : salePrice;

  if (salePriceBeforeTax <= totalCost) {
    document.getElementById('profit_rate').value = 0;
    calcProfit();
    return;
  }

  const profitRate = ((salePriceBeforeTax - totalCost) / salePriceBeforeTax) * 100;
  document.getElementById('profit_rate').value = Math.round(profitRate * 10) / 10;
  calcProfit();
}

