# AGENTS.md — 国庆典藏卡（national-flag）

## 项目概述
零依赖静态网页：国庆 3D 全息典藏卡（Balatro 弹簧倾斜、点击翻面、全息光效）。正面为按 GB 12982 制图参数脚本生成的五星红旗，背面为金属浮雕国徽。纯 vanilla HTML/CSS/JS —— 无 npm、无 lint、无测试。

## 关键规则：根目录文件是构建产物
- 根目录的 `index.html` / `style.css` / `main.js` 全部由 `python3 build.py` 生成，**不要直接编辑**。
- 前端代码的唯一编辑位置是 `src/`（`template.html` / `style.css` / `main.js`），改完运行：

  ```bash
  python3 build.py
  ```

- 重新生成后必须把根目录产物一并提交 —— CI（`.github/workflows/deploy.yml`）不做任何构建，直接把仓库根目录上传到 GitHub Pages。

## build.py 的三个职责
1. **生成国旗** `assets/flag.svg`：GB 12982 官方参数硬编码在 `build_flag()`（30×20 网格，大星 r=3 圆心 (5,5)，四颗小星 r=1 圆心 (10,2)(12,4)(12,7)(10,9)，星尖各指向大星圆心）。改旗帜几何/配色只能改 build.py。
2. **金属化国徽** `vendor/emblem-original.svg` → `assets/emblem-gold.svg`：重着色靠字面量字符串替换（`fill:#ffde00`→`url(#goldMetal)` 渐变、`fill:#de2910`→`url(#bronzeDeep)`、描边→`#33200a`），依赖 vendor 文件保持原格式；换素材需同步改这些替换规则。根 `<svg>` 定位用正则 `<svg[^>]*>`，不能找第一个 `>`（文件带 `<?xml ?>` 声明）。浮雕滤镜（`feDiffuseLighting`/`feSpecularLighting`）参数也在 build.py 的 `GRADIENT_DEFS`。
3. **内联组装**：把两份 SVG 填入 `src/template.html` 的 `<!--INLINE:FLAG-->` / `<!--INLINE:EMBLEM-->` 占位符，输出根目录 `index.html`，并复制 `src/style.css`、`src/main.js` 到根目录。

## 运行与预览
```bash
python3 -m http.server 8765   # http://127.0.0.1:8765
```
直接双击 `index.html` 也可。除此之外没有任何脚本命令。

## 代码约定
- 界面文案、注释、commit message 一律中文（`lang="zh-CN"`）。
- 年份/周年数由 `src/main.js` 动态计算（以 10 月 1 日为界：国庆未到则显示上一届）。`src/template.html` 里的"七十七周年 / 2026"只是 JS 未执行时的静态兜底，**不要手动改年份**。
- 必须保留无障碍与降级路径：`prefers-reduced-motion`（CSS `@media` + JS `reduced` 标志双路）、键盘翻面（`.card3d` 的 `tabindex` + Enter/空格 + `aria-pressed`）、`aria-label`。新增动效需保证 reduced 模式下静态可读。
- `src/main.js` 通过 `getElementById('goldMetal')` 引用国徽 SVG 内的渐变 id，该 id 由 build.py 的 `GRADIENT_DEFS` 生成 —— 改 id 需两处同步。

## 文件地图
| 路径 | 说明 |
| --- | --- |
| `build.py` | 构建脚本（唯一生成逻辑所在） |
| `src/` | 源码，编辑只改这里 |
| `assets/` | 生成的独立 SVG（可随时重建） |
| `vendor/emblem-original.svg` | 国徽原始矢量（Wikimedia Commons 公有领域），勿手工改动 |

## 部署与合规
推送到 `main` 即自动部署 GitHub Pages（workflow 已带 `enablement: true` 自动启用）。每届周年可打 git tag 留档（如 `77th`）。国旗、国徽的使用受《国旗法》《国徽法》约束：不得用于商标、商业广告。更多背景见 `README.md`。
