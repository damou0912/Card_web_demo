# 浏览器卡牌工坊

独立的卡牌制作和实际技能维护工具。无需启动 Unity，无第三方前端依赖，Node.js 18+ 可离线启动。

卡面外观规划使用新增的 [卡面设计室](../card-designer/README.md)：工坊顶部入口或 `http://127.0.0.1:5190/appearance/`。也可双击根目录 `Start-Card-Designer.cmd` 独立启动，拖动设计卡框、立绘及文字，导出图片和布局规范。

## 已接入的卡牌

正式 **90 张卡牌、135 段流程说明**：三国各 30 张，包含 60 张基础卡及 30 张额外卡。

- **77 张原参考卡已接入 Web 实际技能维护**：逐卡保存正式 JavaScript 事件函数、辅助函数、引擎被动标记和运行时常量。可以修改快捷数值、完整脚本、被动开关、技能文案及流程节点说明，导出实际 Web 技能包。
- **13 张现有 Unity 节点映射卡**继续使用原节点编辑方式：王平、周仓、张苞、马岱、糜芳、黄忠、曹休、夏侯恩、于禁、王异、韩当、陈武、徐盛。可以单独导出 Unity 工坊制作库。
- Web 实际技能与 Unity 组合技能使用不同引擎。技能攻击、换位、替身保护、多事件触发及连锁等 Web 规则保留原始实现，不强制转换成不等价的 Unity 效果。
- 正式 Web 数据来源为 `card-info.js`、`replacement-cards.js`；执行来源为 `shu-card-effects.js`、`wei-card-effects.js`、`wu-card-effects.js` 和 `core-v2.js`。
- 不包含临时守军、AI 特性或 Unity 演示卡。工坊配置 ID 使用 `workshop_web_原ID`；Web 导出沿用原 ID 注册对应实际效果。

逐卡事件、标记、依赖函数、源摘要与验证结果见 [CARD_EFFECT_AUDIT.md](CARD_EFFECT_AUDIT.md)。记录保留原版已存在的文案差异，例如甄姬缺少减战力保护标记；可在工坊显式修改，默认不会擅自变更正式规则。

## 打开

双击仓库根目录 `Start-Card-Workshop.cmd`，再访问 **http://127.0.0.1:5190/**。或在仓库根目录运行：

```sh
npm run workshop
```

端口占用可改用 `node card-workshop/server.cjs 5191`。服务仅绑定 127.0.0.1，关闭终端停止服务。服务通过白名单提供编辑器及用于验证的公开游戏脚本，没有文件写入 API。

## 维护 Web 实际技能

1. 左侧搜索原卡 ID、名称或技能名，选择带“Web 技能”的卡。
2. 在“实际技能维护”选择事件或辅助函数。快捷数值会直接修改相应脚本里的调用参数；复杂条件、动态数值、目标引用、返回值与连锁顺序使用脚本编辑区维护。
3. 被动标记可以展开修改。纯被动卡（例如八阵图）没有事件函数，其效果通过引擎读取标记执行；可按需添加已有引擎支持的事件。
4. 脚本输入自动保存为草稿。语法不完整时仍保留文本，禁止导出，修正后可继续。数值、事件增删、标记及流程说明支持本次会话撤销 / 重做；文本框内使用浏览器自己的撤销。
5. 修改脚本后同步维护“当前技能说明”和下方流程节点说明，完成后点击“已核对流程说明”。**流程图是说明文档，连线不生成 Web 脚本；实际执行以脚本和被动标记为准。**
6. “用正式引擎检查原版回归”在可终止的独立 Worker 中加载实际游戏核心与当前 Web 技能包。原版有 214 项断言，覆盖 90 张卡牌的边界场景。修改数值后出现原版断言差异并不自动代表设计错误，需要逐项复核。检查超时 15 秒后终止；不触碰正式游戏页面或账号。
7. 使用“保存工程”保留可继续维护的全部数据。使用“导出当前 Web 卡”导出一张卡的 JavaScript，或“导出 Web 技能包”导出当前工程的全部 Web 实际技能。

导出的 `workshop-web-effects.js` 需要由开发者加入正式页面，在三个势力技能脚本**之后**、`core-v2.js` **之前**加载：

```html
<script src="shu-card-effects.js"></script>
<script src="wei-card-effects.js"></script>
<script src="wu-card-effects.js"></script>
<script src="workshop-web-effects.js"></script>
<script src="core-v2.js"></script>
```

下载不会自动修改正式文件。技能包只包含执行逻辑，卡名、技能文案、品质和展示战力仍需另行同步正式卡表。修改工坊配置 ID 不会改变原卡绑定；同一个原卡存在多个副本时整包导出会拒绝冲突，需单独导出要使用的副本。整个技能包先完成构建，再安装到原始卡牌注册表；删掉事件即从该卡新定义中删除对应事件。

## Unity 节点制作

原 13 张映射卡及新建自制卡仍支持：

- 每卡 0～8 个技能。每技能为触发 → 条件 → 1～8 个顺序效果 → 结束；条件不满足直接结束。
- 效果包含加减战力、一次护盾、抽牌、尝试摧毁及当前行动阶段增加行动。每步独立选目标，不能跨步骤锁定同一随机目标。
- 拖动节点标题移动；空白处平移；点击或拖动端口连线；双击连线断开。删除效果尽可能连接前后节点。
- 未连接草稿可保存，循环、非法参数及不完整流程阻止 Unity 导出。
- 流程预演仅检查路径，不结算战斗、护盾、真实目标、胜负或技能连锁。

Unity 入口：`Card Demo → Tools → Card And Skill Workshop → 导入 JSON`。单卡导出也是整库格式、卡组为空；Unity 导入为整库替换，应先备份或合并。Web 实际技能不能导出为 Unity 可执行技能，含此类卡牌的工程不可导出 Unity 整库。

## 工程、旧草稿与备份

- “保存工程”下载 `card-workshop-project.json`，包含 Web 脚本、参数、辅助函数、标记、卡牌说明、流程图、节点位置及已有测试卡组。
- “导入 JSON”支持浏览器工程和 Unity 制作库，最多 200 张、2 MB；导入前确认替换，可撤销。导入工程只升级已有旧参考卡，不自动补入其他预存卡。
- 升级旧浏览器草稿时，原始 JSON 先备份到 `card-workshop.project.v1.before-web-maintenance-v1`，再为旧参考卡补入对应实际实现。保留名称、配置 ID、布局、说明与卡组引用；不覆盖已编辑的 Web 技能。
- “补齐缺失预存卡”按原始 ID 去重。更新预存版本不会覆盖已维护的实际技能；可导出后与新版预存工程对照合并。
- 草稿仅在同一浏览器、地址和端口下保存，换设备请导出工程。同源另一标签页更新草稿时暂停自动覆盖。损坏的旧草稿不会被静默清空；请定期下载工程备份。

## 维护者命令

```sh
npm run generate:workshop-presets
node card-workshop/build-presets.cjs --check
npm run test:workshop
npm run audit:workshop
node card-workshop/audit.cjs --check
```

生成器逐卡检查原 ID、事件、引擎标记和常量，保留辅助函数的闭包依赖。预存数据变更后需重新生成核对记录。

验证包括：77 张实际函数体逐项比对、原版与导出包在真实引擎中的 214 项回归对照、90 张卡牌边界覆盖、修改参数确实改变实际结算、旧草稿无损迁移、错误脚本草稿保留、导出冲突检查和 Unity 原节点回归。

如已安装 Playwright：

```sh
node card-workshop/browser.test.cjs
```

可通过 `WORKSHOP_PLAYWRIGHT` 指定已有 Playwright 包绝对路径，`WORKSHOP_BROWSER` 指定 Edge / Chrome 可执行文件，`WORKSHOP_SCREENSHOTS` 指定截图目录。测试使用独立临时浏览器上下文，不使用日常浏览器账号。

Unity 兼容检查：

```sh
dotnet run --project card-workshop/compat/WorkshopCompat.csproj --configuration Release -- UnityCard_demo/Assets/Resources/Data/workshop-library.json
```

## 文件职责

- `web-effects.js`：实际技能模型、校验、快捷参数、升级及 Web 包编译。
- `web-editor.js`：事件 / 脚本 / 标记 / 文案编辑及正式规则验证入口。
- `build-presets.cjs`：从实际技能提取 77 张完整实现，生成 90 张预存数据。
- `preset-definitions.cjs`：逐卡流程说明及 13 张 Unity 节点映射。
- `model.js`、`app.js`：节点编辑、工程、撤销及导入导出。
- `verify-worker.js`、`engine-harness.js`、`verify.cjs`：隔离加载未修改的正式规则进行检查。
- `audit.cjs`、`CARD_EFFECT_AUDIT.md`：逐卡核对记录生成与校验。

未提供云同步、美术资源编辑、任意 Web 技能到 Unity 的自动转换或正式服务器发布。现有测试不穷举所有未来的自定义技能组合。
