# 卡牌对战 Demo：当前 V2 开发说明

## 唯一数据与规则来源

正式规则为 `CORE_RULES_V2.md`，卡牌信息与卡牌效果文本来自 `outputs/card-info-table-xlsx/card_info_v2.xlsx`；`card-info.js` 是该表格的运行时导出。旧版卡牌数据与旧版同步行动规则不再使用。

## 文件职责

- `index.html`：正式对局入口。
- `card-info.js`：统一卡牌信息表的运行时导出；其中 `baseAttack` 直接对应表格“基础战力”。
- `v2-card-data.js`：将统一卡牌信息适配为核心使用的卡牌槽位，不保存卡牌文字数据；核心 `attack` 从 `baseAttack` 映射而来。
- `script.js`：共享 DOM、动画和兼容辅助函数；正式玩法由 `core-v2.js` 接管。
- `core-v2.js`：V2 状态、回合、移动、交战、技能、AI 和渲染。
- `online-client.js`、`railway-server.js`：联网客户端与房间服务。
- `card-test.html`、`card-test.js`：V2 场景测试台。

## 技能显示约定

技能名称用于卡面识别；技能栏、详情面板、手牌悬停、战场悬停和测试台统一直接展示表格中的完整 `effect` 原文，原始换行照常显示，不拆分、不去编号、不优化文本。卡牌不单独显示触发词条，也不提取、派生或校验词条。概要字段不存在且不得重新引入。

## 对局约定

支持本地 1v1、PVE、联网对战和 3x3/4x4/5x5 地图。回合按准备、抽牌、回合开始技能、行动、结束清理、回合结束技能执行。开局生成两张中立守军，破坏格最多 5 个，牌库耗尽不生成援兵。

## 修改与验收

任何技能调整都必须同步更新 `effect` 文本、规则逻辑和边界测试；名称、战力、技能名称必须单行自适应显示。修改 `outputs/card-info-table-xlsx/card_info_v2.xlsx` 后运行 `npm run generate:card-info` 更新 `card-info.js`。测试实现位于独立的 `core-v2.test-suite.js`，不随正式页面加载；部署前运行 `core-v2.regression.test.js` 并确认全部测试通过。
