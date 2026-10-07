# 卡牌工坊逐卡核对记录

由 `node card-workshop/audit.cjs` 生成；不要手工修改。

预存版本：`production-613391a0cd6a`。正式 90 张卡全部覆盖：13 张保持现有 Unity 节点编辑，77 张原参考卡已接入 Web 实际技能维护。

已在未修改的正式规则引擎中加载导出技能包，214 项回归断言通过；卡牌边界断言覆盖全部 90 个原始 ID。源函数体、事件列表、被动标记及运行时常量另由 web-effects.test.cjs 对 77 张逐项精确比对。辅助函数随卡牌闭包保存，避免丢失目标选择与连锁规则。

这些是现有规则的回归检查，不穷举未来所有自定义技能组合。UI 中脚本编辑后的回归差异需要按设计意图复核。流程图为说明，实际 Web 效果由脚本和被动标记执行；Unity 格式不承载 Web 脚本。

| 原卡 ID | 卡名 | 势力 | 维护方式 | 实际事件 | 被动标记 | 辅助函数 | 原实现摘要 SHA256 | 边界检查 |
|---|---|---|---|---|---|---|---|---|
| 01101 | 廖化 | 三国~蜀 | Web 实际脚本 | onTurnStart | 无 | 无 | 000476593fb8 | 通过 |
| 01102 | 王平 | 三国~蜀 | Unity 效果节点 | onTurnStart | 无 | 无 | d568f3586d5a | 通过 |
| 01103 | 周仓 | 三国~蜀 | Unity 效果节点 | onTurnStart | 无 | 无 | 18ef030d34c6 | 通过 |
| 01104 | 关兴 | 三国~蜀 | Web 实际脚本 | onTurnStart | 无 | 无 | b62d938475c4 | 通过 |
| 01105 | 张苞 | 三国~蜀 | Unity 效果节点 | onTurnStart | 无 | 无 | cbe867c6c2ce | 通过 |
| 01106 | 马岱 | 三国~蜀 | Unity 效果节点 | onTurnStart | 无 | 无 | 57a84c883acb | 通过 |
| 01107 | 糜芳 | 三国~蜀 | Unity 效果节点 | onTurnStart | 无 | 无 | d49c665bd9a1 | 通过 |
| 01121 | 李恢 | 三国~蜀 | Web 实际脚本 | onTurnStart | 无 | 无 | d9551834cf0b | 通过 |
| 01122 | 张任 | 三国~蜀 | Web 实际脚本 | onTurnStart | 无 | 无 | ad51258cc316 | 通过 |
| 01123 | 陈到 | 三国~蜀 | Web 实际脚本 | onPlace | 无 | 无 | a380189be42a | 通过 |
| 01124 | 刘封 | 三国~蜀 | Web 实际脚本 | onTurnStart | 无 | 无 | ed688ee1785e | 通过 |
| 01208 | 魏延 | 三国~蜀 | Web 实际脚本 | onPlace | 无 | 无 | d85b6444ac39 | 通过 |
| 01209 | 马超 | 三国~蜀 | Web 实际脚本 | onTurnStart | chargeMove | 无 | 7648c7de3654 | 通过 |
| 01210 | 黄忠 | 三国~蜀 | Unity 效果节点 | onTurnStart | 无 | 无 | c6a4539171d7 | 通过 |
| 01211 | 姜维 | 三国~蜀 | Web 实际脚本 | onTurnStart | 无 | 无 | 6412b9da271e | 通过 |
| 01212 | 严颜 | 三国~蜀 | Web 实际脚本 | onTurnStart | cannotMove | 无 | a7f6be1cd8a9 | 通过 |
| 01225 | 刘琦 | 三国~蜀 | Web 实际脚本 | onPlace, onDestroy | cannotMove | 无 | f0c6246c91ef | 通过 |
| 01226 | 法正 | 三国~蜀 | Web 实际脚本 | onTurnStart, onOtherPlaced | 无 | 无 | a7012885c6f0 | 通过 |
| 01227 | 蒋琬 | 三国~蜀 | Web 实际脚本 | onTurnStart | 无 | 无 | c1074953a935 | 通过 |
| 01313 | 赵云 | 三国~蜀 | Web 实际脚本 | onTurnStart, onBeforeDestroy, onTurnEnd | 无 | 无 | a0deeadea9c2 | 通过 |
| 01314 | 诸葛亮 | 三国~蜀 | Web 实际脚本 | 无事件 | avoidCombatWhenBehind, repeatFriendlyTurnStart | 无 | db3b07392f9b | 通过 |
| 01315 | 庞统 | 三国~蜀 | Web 实际脚本 | onTurnStart | 无 | 无 | 558b79172545 | 通过 |
| 01328 | 张飞 | 三国~蜀 | Web 实际脚本 | onPlace, onTurnStart, onCombatResolved | 无 | attackRandomAdjacentEnemy | 2897248b3a68 | 通过 |
| 01416 | 关羽 | 三国~蜀 | Web 实际脚本 | onTurnStart, onCombatResolved | freeAction | 无 | da3db32704fb | 通过 |
| 01429 | 刘备 | 三国~蜀 | Web 实际脚本 | onTurnStart, onEnemyTurnEnd | cannotMove | 无 | 6c89ef6341d0 | 通过 |
| 01517 | 连弩营 | 三国~蜀 | Web 实际脚本 | onTurnStart | 无 | 无 | fe84a23ad47f | 通过 |
| 01518 | 八阵图 | 三国~蜀 | Web 实际脚本 | 无事件 | substituteAdjacent | 无 | 98e1697b3904 | 通过 |
| 01519 | 木牛流马 | 三国~蜀 | Web 实际脚本 | onTurnStart, onDrawFailed | 无 | 无 | abb41fca2442 | 通过 |
| 01520 | 昭烈仁德令 | 三国~蜀 | Web 实际脚本 | onTurnStart | 无 | 无 | bcb229b9d711 | 通过 |
| 01530 | 七星灯 | 三国~蜀 | Web 实际脚本 | onBeforeAllyDestroy, onTurnEnd | 无 | 无 | c48069cf13ef | 通过 |
| 02101 | 曹洪 | 三国~魏 | Web 实际脚本 | onPlace | 无 | 无 | e97335baa3d7 | 通过 |
| 02102 | 曹休 | 三国~魏 | Unity 效果节点 | onPlace | 无 | 无 | 2d244001be2d | 通过 |
| 02103 | 夏侯恩 | 三国~魏 | Unity 效果节点 | onPlace | 无 | 无 | 96bfe136f120 | 通过 |
| 02104 | 于禁 | 三国~魏 | Unity 效果节点 | onPlace | 无 | 无 | 14b5ad5b322f | 通过 |
| 02105 | 李典 | 三国~魏 | Web 实际脚本 | onPlace | 无 | 无 | 0ca886e3bc0b | 通过 |
| 02106 | 臧霸 | 三国~魏 | Web 实际脚本 | onPlace | 无 | 无 | 8a48411dc3c3 | 通过 |
| 02107 | 毛玠 | 三国~魏 | Web 实际脚本 | onPlace | 无 | 无 | 447e19a1ee06 | 通过 |
| 02121 | 文聘 | 三国~魏 | Web 实际脚本 | onPlace | 无 | 无 | 009321f8a8e0 | 通过 |
| 02122 | 牛金 | 三国~魏 | Web 实际脚本 | onPlace | 无 | 无 | 51a720a29b01 | 通过 |
| 02123 | 王异 | 三国~魏 | Unity 效果节点 | onPlace | 无 | 无 | f7d3a71bbea9 | 通过 |
| 02124 | 陈群 | 三国~魏 | Web 实际脚本 | onPlace | 无 | 无 | 0bae7e063edc | 通过 |
| 02208 | 徐晃 | 三国~魏 | Web 实际脚本 | onPlace | 无 | 无 | dacbe6112c91 | 通过 |
| 02209 | 张郃 | 三国~魏 | Web 实际脚本 | onPlace | 无 | 无 | a247f291e734 | 通过 |
| 02210 | 曹仁 | 三国~魏 | Web 实际脚本 | onBeforeAdjacentAllyDestroy | 无 | 无 | b96c305f1a58 | 通过 |
| 02211 | 夏侯渊 | 三国~魏 | Web 实际脚本 | 无事件 | longMove | 无 | 9a5e9e12d63a | 通过 |
| 02212 | 乐进 | 三国~魏 | Web 实际脚本 | onTurnStart | 无 | 无 | 42652ed72019 | 通过 |
| 02225 | 郭淮 | 三国~魏 | Web 实际脚本 | onTurnStart | 无 | 无 | 7b2cb1faf26a | 通过 |
| 02226 | 满宠 | 三国~魏 | Web 实际脚本 | onUnderAttack | 无 | 无 | c1f7116335b3 | 通过 |
| 02227 | 邓艾 | 三国~魏 | Web 实际脚本 | 无事件 | diagonalMove | 无 | f504832fd4e6 | 通过 |
| 02313 | 许褚 | 三国~魏 | Web 实际脚本 | onPlace, onTurnStart | 无 | 无 | 32776e11b790 | 通过 |
| 02314 | 司马懿 | 三国~魏 | Web 实际脚本 | onPlace, onTurnEnd | 无 | 无 | dcd7a47ba258 | 通过 |
| 02315 | 甄姬 | 三国~魏 | Web 实际脚本 | onPlace, onOwnCardAttackIncreased | 无 | 无 | 46608fa60775 | 通过 |
| 02328 | 张辽 | 三国~魏 | Web 实际脚本 | onBeforeAttack, onCombatResolved | 无 | 无 | 3f0790cbcb89 | 通过 |
| 02416 | 曹操 | 三国~魏 | Web 实际脚本 | onPlace, onOtherPlaced | 无 | 无 | 56b5089b03d5 | 通过 |
| 02429 | 曹丕 | 三国~魏 | Web 实际脚本 | onPlace, onOwnCardAttackIncreased, onTurnStart | 无 | 无 | 4fc68b66d55d | 通过 |
| 02517 | 虎豹骑 | 三国~魏 | Web 实际脚本 | onPlace | 无 | 无 | d149d43ba384 | 通过 |
| 02518 | 屯田营 | 三国~魏 | Web 实际脚本 | onPlace | 无 | 无 | 2f58f0b118f9 | 通过 |
| 02519 | 挟天子令 | 三国~魏 | Web 实际脚本 | onPlace | 无 | 无 | bf0165d036e7 | 通过 |
| 02520 | 青州归战旗 | 三国~魏 | Web 实际脚本 | onOtherPlaced | 无 | 无 | b48dbd562257 | 通过 |
| 02530 | 魏武虎符 | 三国~魏 | Web 实际脚本 | 无事件 | cannotMove, firstFriendlyPlacementFree | 无 | 8fe33de0607c | 通过 |
| 03101 | 韩当 | 三国~吴 | Unity 效果节点 | onDestroy | 无 | 无 | dcf024bb8de4 | 通过 |
| 03102 | 蒋钦 | 三国~吴 | Web 实际脚本 | onPlace | 无 | 无 | ab32055c06b0 | 通过 |
| 03103 | 周泰 | 三国~吴 | Web 实际脚本 | onPlace, onBeforeDestroy, onDestroy | 无 | destroyLowerAdjacent | 69081759031c | 通过 |
| 03104 | 陈武 | 三国~吴 | Unity 效果节点 | onDestroy | 无 | 无 | 16511b5783b1 | 通过 |
| 03105 | 丁奉 | 三国~吴 | Web 实际脚本 | onDestroy | 无 | 无 | 731c85e980bb | 通过 |
| 03106 | 徐盛 | 三国~吴 | Unity 效果节点 | onPlace, onDestroy | 无 | 无 | 7a3bbceb8a20 | 通过 |
| 03107 | 潘璋 | 三国~吴 | Web 实际脚本 | onDestroy | 无 | 无 | b2f6a117748c | 通过 |
| 03121 | 朱桓 | 三国~吴 | Web 实际脚本 | onDestroy | 无 | 无 | 0111161c918d | 通过 |
| 03122 | 董袭 | 三国~吴 | Web 实际脚本 | onDestroy | 无 | 无 | 37799625032e | 通过 |
| 03123 | 贺齐 | 三国~吴 | Web 实际脚本 | onDestroy | 无 | 无 | 5d41325dfef7 | 通过 |
| 03124 | 步骘 | 三国~吴 | Web 实际脚本 | onPlace, onDestroy | 无 | 无 | 3cc7596da7a5 | 通过 |
| 03208 | 甘宁 | 三国~吴 | Web 实际脚本 | onPlace, onDestroy | 无 | 无 | 8997f226aa3c | 通过 |
| 03209 | 太史慈 | 三国~吴 | Web 实际脚本 | onDestroy | 无 | 无 | 7875235de249 | 通过 |
| 03210 | 凌统 | 三国~吴 | Web 实际脚本 | onDestroy | 无 | 无 | 4c53763ae42a | 通过 |
| 03211 | 程普 | 三国~吴 | Web 实际脚本 | onDestroy | 无 | 无 | bc6a03235784 | 通过 |
| 03212 | 黄盖 | 三国~吴 | Web 实际脚本 | onPlace, onBeforeDestroy, onDestroy | 无 | 无 | 57c45f1b1cc4 | 通过 |
| 03225 | 鲁肃 | 三国~吴 | Web 实际脚本 | onPlace | 无 | 无 | ab86f35c5a8d | 通过 |
| 03226 | 周鲂 | 三国~吴 | Web 实际脚本 | onPlace, onDestroy | 无 | 无 | fa81385c3475 | 通过 |
| 03227 | 陆抗 | 三国~吴 | Web 实际脚本 | onOtherMoved | 无 | 无 | f0c2fd9ceba2 | 通过 |
| 03313 | 陆逊 | 三国~吴 | Web 实际脚本 | onDestroy | 无 | 无 | de497d0248a4 | 通过 |
| 03314 | 吕蒙 | 三国~吴 | Web 实际脚本 | onPlace, onOtherDrawn, onDestroy | 无 | 无 | 45d39171f2ad | 通过 |
| 03315 | 周瑜 | 三国~吴 | Web 实际脚本 | onPlace, onDestroy | 无 | 无 | 4ddb3771944f | 通过 |
| 03328 | 孙坚 | 三国~吴 | Web 实际脚本 | onPlace, onTurnStart, onDestroy | 无 | 无 | 13372af3541a | 通过 |
| 03416 | 孙策 | 三国~吴 | Web 实际脚本 | onTurnStart, onBeforeAttack | 无 | 无 | 068ace342284 | 通过 |
| 03429 | 孙权 | 三国~吴 | Web 实际脚本 | onOtherDestroyed, onDestroy, onTurnStart | 无 | randomDestroyEffectTarget | 01f1e90e8925 | 通过 |
| 03517 | 楼船阵 | 三国~吴 | Web 实际脚本 | onBeforeAdjacentAllyDestroy | 无 | 无 | 55b31ac71fe3 | 通过 |
| 03518 | 赤焰舟 | 三国~吴 | Web 实际脚本 | onDestroy | 无 | 无 | 33a201aa6bfa | 通过 |
| 03519 | 长江天险 | 三国~吴 | Web 实际脚本 | onBeforeDestroy, onTurnStart, onUnderAttack | 无 | 无 | 349478c7661b | 通过 |
| 03520 | 赤壁火攻令 | 三国~吴 | Web 实际脚本 | onPlace | 无 | 无 | af6c9aaa0cf3 | 通过 |
| 03530 | 传国玉玺 | 三国~吴 | Web 实际脚本 | onTurnStart, onDestroy | cannotMove | randomDestroyEffectTarget | c7d7937816f7 | 通过 |

## 已记录的规则差异与边界

以当前正式代码为基准，保留以下已存在的差异，未擅自改写原游戏规则。甄姬缺失的减益保护标记可在工坊显式维护。

- **01225 刘琦**：当前 Web 代码在遗志时重新查找相邻目标，而非保存入场时的目标列表；流程保留此实际行为，不擅自修正规则。
- **01226 法正**：原说明写“本回合第一张”，当前实现增加永久战力，非临时战力。
- **01328 张飞**：起势扣除战力在当前实现中是临时值；实际连锁由 Web 引擎执行，参考图不运行循环。
- **02123 王异**：按当前 Web 实现选择“其他”己方卡牌，不包含王异自身；并列最低随机 1 张。
- **02314 司马懿**：实际代码两段都排除司马懿自身；只按成功摧毁数量增益。
- **02315 甄姬**：发现说明与实现不一致：coreCanReduceAttack 读取 preventReduction，但甄姬定义未启用此标记。本次仅记录差异，不修改正式游戏规则。
- **03105 丁奉**：当前实现只检查原因卡存在和在场，没有额外筛选其阵营。
- **03517 楼船阵**：当前实现中楼船阵自身若被其他保护阻止摧毁，仍阻止被保护友军的摧毁；按代码保留。
