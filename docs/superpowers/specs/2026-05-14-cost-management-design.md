# 非原料成本管理模块设计

## 概述

在水溶肥配方计算系统中新增独立的「成本管理」Tab（第4个Tab），用于管理电费、包材、人工等非原料生产成本。这些成本项仅在核价计算中使用，不参与含量计算的LP优化。

## 数据模型

```javascript
{
  id: string,              // 唯一标识
  name: string,            // 显示名称
  category: string,        // 分类: energy|material|labor|logistics|depreciation|overhead|custom
  mode: "fixed"|"split",   // fixed=固定元/吨, split=总额÷月产量
  unitCost: number,        // fixed模式: 元/吨
  totalAmount: number,     // split模式: 总金额(元)
  monthlyOutput: number,   // split模式: 月产量(吨)
  enabled: boolean         // 是否启用参与核价计算
}
```

## 预设成本项

| 分类 | 名称 | 默认值(元/吨) |
|------|------|--------------|
| energy | 电费 | 50 |
| energy | 燃气/蒸汽 | 30 |
| material | 包装袋 | 80 |
| material | 标签/喷码 | 5 |
| labor | 生产人工 | 120 |
| labor | 质检人工 | 20 |
| logistics | 厂内运输 | 15 |
| depreciation | 设备折旧 | 60 |
| overhead | 制造费用 | 40 |

## UI设计

### Tab 4: 成本管理
- 顶部汇总卡片：总附加成本(元/吨)、已启用项数
- 成本项表格：启用开关 | 分类 | 名称 | 计算模式(下拉) | 单价或总额 | 月产量 | 折算单价
- 底部：添加自定义成本项按钮

### 核价计算Tab变化
- 结果区新增：附加成本卡片、生产总成本卡片
- 详细报告Modal新增：生产附加成本明细section、成本结构占比
- Excel导出新增Sheet：生产成本明细

## 计算逻辑

```
折算单价 = mode === "fixed" ? unitCost : totalAmount / monthlyOutput
附加成本合计 = Σ(已启用项的折算单价)
生产总成本 = 裸料成本 + 附加成本合计
```

## 持久化

localStorage `feiliao_v1` 新增 `costItems` 字段，配置导入/导出同步包含。
