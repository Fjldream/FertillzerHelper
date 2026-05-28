/**
 * solver.js — 线性规划求解器（单纯形法 / 大M法）
 *
 * 求解标准型：Min c·x  s.t. A_eq·x = b_eq, x ≥ 0
 * 用于含量计算和核价计算中的最优配比求解。
 *
 * @param {number[]}   c     - 目标函数系数向量（最小化）
 * @param {number[][]} A_eq  - 等式约束矩阵（m × n）
 * @param {number[]}   b_eq  - 等式约束右端向量（长度 m）
 * @param {*}          bounds - 保留参数（当前实现默认 x ≥ 0）
 * @returns {number[]|null} 最优解向量，无解返回 null
 */
function simplex(c, A_eq, b_eq, bounds) {
  const n = c.length;
  const m = A_eq.length;
  const BIG_M = 1e7;

  // 确保 b ≥ 0（翻转负约束行）
  for (let i = 0; i < m; i++) {
    if (b_eq[i] < 0) {
      b_eq[i] = -b_eq[i];
      for (let j = 0; j < n; j++) A_eq[i][j] = -A_eq[i][j];
    }
  }

  // 添加人工变量，构建初始单纯形表
  const total = n + m;
  const tableau = [];
  for (let i = 0; i < m; i++) {
    const row = [...A_eq[i]];
    for (let k = 0; k < m; k++) row.push(k === i ? 1 : 0);
    row.push(b_eq[i]);
    tableau.push(row);
  }

  // 目标行（大M惩罚人工变量）
  const objRow = [...c];
  for (let k = 0; k < m; k++) objRow.push(BIG_M);
  objRow.push(0);

  // 消去人工变量在目标行的初始影响
  for (let i = 0; i < m; i++) {
    for (let j = 0; j <= total; j++) objRow[j] -= BIG_M * tableau[i][j];
  }
  tableau.push(objRow);

  // 基变量索引（初始为人工变量）
  const basis = [];
  for (let i = 0; i < m; i++) basis.push(n + i);

  // 迭代求解
  const MAXITER = 500;
  for (let iter = 0; iter < MAXITER; iter++) {
    const obj = tableau[m];

    // 寻找进基变量（目标行最小负系数）
    let pivCol = -1, minVal = 1e-9;
    for (let j = 0; j < total; j++) {
      if (obj[j] < minVal) { minVal = obj[j]; pivCol = j; }
    }
    if (pivCol === -1) break; // 已最优

    // 寻找出基变量（最小正比值规则）
    let pivRow = -1, minRatio = Infinity;
    for (let i = 0; i < m; i++) {
      if (tableau[i][pivCol] > 1e-9) {
        const ratio = tableau[i][total] / tableau[i][pivCol];
        if (ratio < minRatio) { minRatio = ratio; pivRow = i; }
      }
    }
    if (pivRow === -1) return null; // 无界

    // 旋转操作
    const piv = tableau[pivRow][pivCol];
    for (let j = 0; j <= total; j++) tableau[pivRow][j] /= piv;
    for (let i = 0; i <= m; i++) {
      if (i === pivRow) continue;
      const factor = tableau[i][pivCol];
      for (let j = 0; j <= total; j++) tableau[i][j] -= factor * tableau[pivRow][j];
    }
    basis[pivRow] = pivCol;
  }

  // 提取最优解
  const x = new Array(n).fill(0);
  for (let i = 0; i < m; i++) {
    if (basis[i] < n) x[basis[i]] = tableau[i][total];
  }
  return x;
}
