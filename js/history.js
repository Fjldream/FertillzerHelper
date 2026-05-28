/**
 * history.js — 原料价格历史与敏感度分析
 */

/** 打开价格历史弹窗 */
function openPriceHistory(rawIndex) {
  const raw = rawMaterials[rawIndex];
  if (!raw) return;

  const history = raw.priceHistory || [];
  if (history.length === 0) {
    alert('该原料暂无价格历史记录');
    return;
  }

  // 创建弹窗
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>📈 ${escapeHtml(raw.name)} - 价格历史</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>
      <div class="modal-body">
        <canvas id="priceChart" width="500" height="300" style="width:100%;max-width:500px;margin:0 auto;display:block"></canvas>
        <div style="margin-top:20px">
          <table>
            <thead><tr><th>日期</th><th>价格（元/吨）</th><th>涨跌</th></tr></thead>
            <tbody>
              ${history.map((h, i) => {
                const prev = i > 0 ? history[i-1].price : h.price;
                const diff = h.price - prev;
                return `
                  <tr>
                    <td>${h.date}</td>
                    <td><b>${h.price.toLocaleString()}</b></td>
                    <td style="color:${diff > 0 ? '#f5576c' : diff < 0 ? '#11998e' : '#666'}">${diff > 0 ? '+' : ''}${diff.toLocaleString()}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // 绘制折线图
  setTimeout(() => drawPriceChart(history), 50);
}

/** 绘制价格折线图 */
function drawPriceChart(history) {
  const canvas = document.getElementById('priceChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const padding = 40;

  // 清空画布
  ctx.clearRect(0, 0, w, h);

  // 背景
  ctx.fillStyle = '#f8f9ff';
  ctx.fillRect(0, 0, w, h);

  // 数据范围
  const prices = history.map(h => h.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  // 坐标转换
  const xScale = (w - 2 * padding) / (history.length - 1 || 1);
  const yScale = (h - 2 * padding) / priceRange;

  const toX = (i) => padding + i * xScale;
  const toY = (price) => h - padding - (price - minPrice) * yScale;

  // 绘制网格线
  ctx.strokeStyle = '#e0e4ff';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = padding + (h - 2 * padding) * i / 5;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(w - padding, y);
    ctx.stroke();
  }

  // 绘制折线
  ctx.strokeStyle = '#667eea';
  ctx.lineWidth = 2;
  ctx.beginPath();
  history.forEach((h, i) => {
    const x = toX(i);
    const y = toY(h.price);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // 绘制数据点
  ctx.fillStyle = '#667eea';
  history.forEach((h, i) => {
    const x = toX(i);
    const y = toY(h.price);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // 绘制坐标轴
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, h - padding);
  ctx.lineTo(w - padding, h - padding);
  ctx.stroke();

  // Y轴标签
  ctx.fillStyle = '#333';
  ctx.font = '12px Arial';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 5; i++) {
    const price = minPrice + priceRange * (5 - i) / 5;
    const y = padding + (h - 2 * padding) * i / 5;
    ctx.fillText(Math.round(price), padding - 5, y + 4);
  }

  // X轴标签（只显示首尾）
  ctx.textAlign = 'center';
  if (history.length > 0) {
    ctx.fillText(history[0].date.slice(5), toX(0), h - padding + 20);
    if (history.length > 1) {
      ctx.fillText(history[history.length - 1].date.slice(5), toX(history.length - 1), h - padding + 20);
    }
  }
}

/** 打开敏感度分析弹窗 */
function openSensitivityAnalysis() {
  const cached = AppState.lastFormulaResult || AppState.lastPricingResult;
  if (!cached) {
    alert('请先完成配方求解');
    return;
  }

  const { allRaws, allPcts } = cached;
  const baseCost = allPcts.reduce((s, p, i) => s + p * allRaws[i].price, 0);

  // 计算每种原料涨价100元/吨时的成本变化
  const sensitivity = allRaws.map((raw, i) => {
    const newCost = allPcts.reduce((s, p, j) => {
      const price = j === i ? raw.price + 100 : allRaws[j].price;
      return s + p * price;
    }, 0);
    return {
      name: raw.name,
      pct: allPcts[i],
      impact: newCost - baseCost,
    };
  }).filter(s => s.pct > 0.001).sort((a, b) => b.impact - a.impact);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>📊 价格敏感度分析</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>
      <div class="modal-body">
        <div class="alert alert-info">
          <b>分析说明：</b>假设每种原料单独涨价 100 元/吨，对配方总成本的影响程度。
        </div>
        <table>
          <thead>
            <tr>
              <th>原料</th>
              <th>配方占比</th>
              <th>涨价 100 元/吨</th>
              <th>成本增加（元/吨）</th>
              <th>敏感度</th>
            </tr>
          </thead>
          <tbody>
            ${sensitivity.map(s => `
              <tr>
                <td><b>${escapeHtml(s.name)}</b></td>
                <td>${fmt(s.pct * 100, 2)}%</td>
                <td style="color:#f5576c">+100</td>
                <td style="color:#f5576c;font-weight:700">+${fmt(s.impact, 2)}</td>
                <td>
                  <div class="progress-bar" style="width:150px">
                    <div class="progress-fill" style="width:${s.impact / sensitivity[0].impact * 100}%;background:#f5576c"></div>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="alert alert-warn" style="margin-top:16px">
          <b>建议：</b>敏感度高的原料价格波动对成本影响大，建议重点关注其市场行情，或寻找替代原料。
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}
