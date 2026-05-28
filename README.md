# FertilizerHelper

肥料配方优化与成本管理桌面应用，基于 Electron 构建，支持 macOS 和 Windows。

## 功能

- **原料管理** — 管理 NPK、氯含量、pH 值及 Ca/Mg/Fe/Mn/Zn/Cu/B/Mo 等微量元素
- **配方优化（含量计算）** — 设定目标养分配比，使用线性规划（单纯形法）自动求解成本最低的原料配比
- **核价计算** — 自动求解最优配比，支持利润核算、运费、增值税、多包装规格报价
- **配方库** — 保存/加载/对比配方
- **成本管理** — 价格历史追踪、价格敏感度分析
- **产品类型判定** — 根据养分含量自动判定产品类型和国标执行标准号
- **导出/导入** — 支持导出配置为 Excel 文件，导入恢复数据
- **自动备份** — 每日自动备份到本地，保留最近 30 天

## 技术栈

- Electron 32
- 线性规划求解器（单纯形法 / 大M法）
- SheetJS（Excel 导出）
- electron-builder（打包）

## 开发

```bash
# 安装依赖
npm install

# 启动开发模式
npm start

# 打包 macOS (ARM64)
npm run dist:mac

# 打包 Windows (x64)
npm run dist:win
```

## 项目结构

```
├── main.js          # Electron 主进程
├── preload.js       # 预加载脚本（IPC 桥接）
├── index.html       # 主界面
├── js/
│   ├── solver.js    # 线性规划求解器
│   ├── data.js      # 默认数据
│   ├── formula.js   # 配方优化模块
│   ├── pricing.js   # 核价计算模块
│   ├── raw.js       # 原料管理模块
│   ├── recipes.js   # 配方库模块
│   ├── cost.js      # 成本管理模块
│   ├── trace.js     # 微量元素模块
│   ├── license.js   # 激活验证模块
│   ├── export.js    # 导入导出模块
│   ├── storage.js   # 本地存储模块
│   ├── utils.js     # 工具函数
│   └── app.js       # 初始化 & Tab 切换
├── css/
│   └── main.css     # 样式
└── build/           # 应用图标
```

## License

MIT
