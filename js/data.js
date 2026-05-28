/**
 * data.js — 默认数据常量
 * 原料库、配方行、固定辅料、核价行的初始默认值（与 Excel 保持一致）
 */

// 常用微量元素列表（可扩展）
const COMMON_TRACE_ELEMENTS = [
  { symbol: 'Ca', name: '钙' },
  { symbol: 'Mg', name: '镁' },
  { symbol: 'S', name: '硫' },
  { symbol: 'Fe', name: '铁' },
  { symbol: 'Mn', name: '锰' },
  { symbol: 'Zn', name: '锌' },
  { symbol: 'Cu', name: '铜' },
  { symbol: 'B', name: '硼' },
  { symbol: 'Mo', name: '钼' },
  { symbol: 'Co', name: '钴' },
]

const DEFAULT_RAW = [
  { name: '尿素', price: 1950, n: 46, p: 0, k: 0, cl: 0, ph: 7.0, priceHistory: [], trace: {} },
  { name: '硫酸铵', price: 1000, n: 20.5, p: 0, k: 0, cl: 0, ph: 4.5, priceHistory: [], trace: {} },
  { name: '磷酸脲', price: 5000, n: 17, p: 42, k: 0, cl: 0, ph: 2.0, priceHistory: [], trace: {} },
  { name: '返料', price: 0, n: 15, p: 5, k: 35, cl: 0, ph: 5.5, priceHistory: [], trace: {} },
  { name: '硝酸钾', price: 4550, n: 13.5, p: 0, k: 46, cl: 0, ph: 7.0, priceHistory: [], trace: {} },
  { name: '磷酸一铵', price: 6900, n: 12, p: 61, k: 0, cl: 0, ph: 4.0, priceHistory: [], trace: {} },
  { name: '磷酸二氢钾', price: 8700, n: 0, p: 52, k: 34, cl: 0, ph: 4.5, priceHistory: [], trace: {} },
  { name: '硫酸钾', price: 4000, n: 0, p: 0, k: 52, cl: 0, ph: 6.5, priceHistory: [], trace: {} },
  { name: '矿源', price: 9000, n: 0, p: 0, k: 10, cl: 0, ph: 9.0, priceHistory: [], trace: {} },
  { name: '防板剂', price: 3000, n: 0, p: 0, k: 0, cl: 0, ph: 7.0, priceHistory: [], trace: {} },
  { name: '海藻', price: 25000, n: 0, p: 0, k: 0, cl: 0, ph: 8.0, priceHistory: [], trace: {} }
]

const DEFAULT_FORMULA_ROWS = [
  { name: '磷酸一铵' },
  { name: '硝酸钾' },
  { name: '尿素' },
  { name: '磷酸二氢钾' },
  { name: '矿源' },
]

const DEFAULT_FIXED_ROWS = [
  { name: '防板剂', pct: 2.48 },
  { name: '海藻', pct: 0.99 },
]

const DEFAULT_PRICING_ROWS = [
  { name: '硫酸铵', fixed: false, pct: 0 },
  { name: '硫酸钾', fixed: false, pct: 0 },
  { name: '磷酸一铵', fixed: false, pct: 0 },
  { name: '尿素', fixed: false, pct: 0 },
  { name: '防板剂', fixed: true, pct: 0.5 },
]
