# AGENTS.md — 国庆典藏卡（national-flag）

## 项目概述
零依赖静态网页：国庆 3D 全息典藏卡（Balatro 弹簧倾斜、点击翻面、全息光效）。正面为按 GB 12982 制图参数脚本生成的五星红旗，背面为金属浮雕国徽。纯 vanilla HTML/CSS/JS —— 无 npm、无 lint、无测试。

## 关键规则：根目录文件是构建产物
- 根目录的 `index.html` / `style.css` / `main.js` / `sw.js` / `manifest.webmanifest` 全部由 `python3 build.py` 生成，**不要直接编辑**。
- 前端代码的唯一编辑位置是 `src/`（`template.html` / `style.css` / `main.js` / `sw.js`），改完运行：

  ```bash
  python3 build.py
  ```

- 重新生成后必须把根目录产物一并提交 —— CI（`.github/workflows/deploy.yml`）不做任何构建，直接把仓库根目录上传到 GitHub Pages。

## build.py 的四个职责
1. **生成国旗** `assets/flag.svg`：GB 12982 官方参数硬编码在 `build_flag()`（30×20 网格，大星 r=3 圆心 (5,5)，四颗小星 r=1 圆心 (10,2)(12,4)(12,7)(10,9)，星尖各指向大星圆心）。改旗帜几何/配色只能改 build.py。
2. **金属化国徽** `vendor/emblem-original.svg` → `assets/emblem-gold.svg`：重着色靠字面量字符串替换（`fill:#ffde00`→`url(#goldMetal)` 渐变、`fill:#de2910`→`url(#bronzeDeep)`、描边→`#33200a`），依赖 vendor 文件保持原格式；换素材需同步改这些替换规则。根 `<svg>` 定位用正则 `<svg[^>]*>`，不能找第一个 `>`（文件带 `<?xml ?>` 声明）。浮雕滤镜（`feDiffuseLighting`/`feSpecularLighting`）参数也在 build.py 的 `GRADIENT_DEFS`。
3. **生成 PWA 图标与清单**：`build_icon()` 用纯标准库（扫描线 + 超采样）把与国旗同源的星组几何光栅化成 `assets/icon-192.png`、`icon-512.png`、`icon-maskable-*.png`、`apple-touch-icon.png`（红底金星，星组居中；maskable 版 span 更小以躲启动器裁切安全区），并把静态清单写出为根目录 `manifest.webmanifest`。
4. **内联组装**：把两份 SVG 填入 `src/template.html` 的 `<!--INLINE:FLAG-->` / `<!--INLINE:EMBLEM-->` 占位符，输出根目录 `index.html`，并复制 `src/style.css`、`src/main.js`、`src/sw.js` 到根目录。

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
- PWA：站点部署在 GitHub Pages 项目页的 `/仓库名/` 子路径下，`manifest.webmanifest` 的 `start_url`/`scope`/图标以及 `src/sw.js` 的预缓存清单**必须用相对路径**。改了静态资源清单（增删文件）或缓存策略后，要同步把 `src/sw.js` 顶部的 `CACHE` 版本号 +1，旧缓存才会被清掉。

## 文件地图
| 路径 | 说明 |
| --- | --- |
| `build.py` | 构建脚本（唯一生成逻辑所在） |
| `src/` | 源码，编辑只改这里（含 PWA 的 `src/sw.js`） |
| `assets/` | 生成的独立 SVG 与 PWA 图标 PNG（可随时重建） |
| `vendor/emblem-original.svg` | 国徽原始矢量（Wikimedia Commons 公有领域），勿手工改动 |
| `manifest.webmanifest` | PWA 清单（build.py 生成） |
| `sw.js` | Service Worker（由 `src/sw.js` 复制，根目录放它才拿得到全站 scope） |

## 部署与合规
推送到 `main` 即自动部署 GitHub Pages（workflow 已带 `enablement: true` 自动启用）。每届周年可打 git tag 留档（如 `77th`）。国旗、国徽的使用受《国旗法》《国徽法》约束：不得用于商标、商业广告。更多背景见 `README.md`。
