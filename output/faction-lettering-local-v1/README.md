# 势力艺术字 · 本地预览 v1

三种字体与材质加工方案，文字均为「魏／蜀／吴」。不是 AI 生成，不调用 API，不需要密钥，没有改动 Unity。

## 查看

- `comparison.png`：三版对比，每版包含大字与小尺寸预览。
- `01-cinnabar.png`：朱砂印章，厚字形加印框、印泥纹理。
- `02-ink.png`：水墨书法，行楷字形加轻微飞白。
- `03-bronze.png`：青铜金属，金铜渐变、浮雕边缘。
- `*-transparent.png`：每个势力单独的 640 × 640 透明 PNG，尚未导入 Unity。

小尺寸预览用于初步检查辨识度，不代表最终卡牌上的尺寸。朱砂版含印框，另外两版只有字形与材质。

## 字体与使用范围

- 朱砂、青铜字形：本机 Noto Serif SC；标签：本机 Noto Sans SC。Noto 项目采用 SIL Open Font License。
- 水墨字形：本机华文行楷（STXingkai）。仅用于此次本地风格预览，未核验该字体的游戏商业发布／嵌入授权。选定后应核验授权，或改用授权明确的开源书法字体重新制作。
- 此目录未复制或分发任何字体文件。透明 PNG 也不表示可以跳过所用字体的授权核验。

## 重现与调整

`render_previews.py` 使用 Pillow 和 NumPy 本地渲染。可调整 `STYLES` 的字体、色板和材质函数；使用固定随机种子。已有预览不会被覆盖，重新制作时请先复制脚本到新的版本目录。

当前环境执行程序：

```powershell
& 'C:\Users\os_dabn\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'C:\codex_card\output\faction-lettering-local-v1\render_previews.py'
```
