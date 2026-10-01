# 国庆典藏卡 · 1949 —

庆祝中华人民共和国国庆的 3D 全息典藏卡。年份动态计算（以 10 月 1 日为界自动推算当前周年），每年国庆自动"长大一岁"；每届可用 git tag 留档（如 `77th`）。

> 在线预览：`https://<username>.github.io/national-day-holo-card/`

- **正面**：五星红旗（按 GB 12982 制图标准用脚本精确生成）
- **背面**：金属浮雕国徽（alpha 高度图光照滤镜 + 双色金渐变）
- **交互**：小丑牌（Balatro）式弹簧倾斜——鼠标在哪，卡片就往哪"下压"，悬停抬起、按住缩小；**点击翻面**，翻面带甩动冲量并迸发金色礼花
- **光效**：彩虹镭射箔（color-dodge）、闪光噪点、镜面高光、掠过旗帜的高光带、国徽金属流光与星芒 glint，全部跟随指针；背景为缓缓上升的金色余烬

## 部署到 GitHub Pages

仓库已带 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)，推送到 `main` 即自动部署：

```bash
git init && git add -A && git commit -m "feat: 国庆典藏卡"
git remote add origin git@github.com:<username>/national-day-holo-card.git
git push -u origin main
git tag 77th && git push origin 77th   # 每届周年打 tag 留档
```

首次部署前在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。

## 运行

无任何依赖，直接双击 `index.html` 或：

```bash
python3 -m http.server 8765
# 打开 http://127.0.0.1:8765
```

## 重新构建

```bash
python3 build.py
```

`build.py` 做三件事：

1. `assets/flag.svg` —— 按官方制图参数（30×20 网格、大星半径 3、圆心 (5,5)，四颗小星半径 1、圆心 (10,2)(12,4)(12,7)(10,9) 且星尖各指向大星圆心）生成国旗；
2. `assets/emblem-gold.svg` —— 读取 `vendor/emblem-original.svg`（来源：Wikimedia Commons *National Emblem of the People's Republic of China.svg*），把金色部件重着色为 `goldMetal` 金属渐变、红色部件重着色为 `bronzeDeep` 古铜金，黑描边改为雕刻深褐，并套一层 `feDiffuseLighting` + `feSpecularLighting` 浮雕滤镜（光源固定左上，可调 azimuth/elevation）；
3. 把两份矢量内联进 `src/template.html`，连同 `src/style.css`、`src/main.js` 输出到项目根目录。

## 文件

```
build.py              构建脚本（国旗生成 / 国徽金属化 / 内联组装）
src/template.html     页面结构（含 SVG 内联占位符）
src/style.css         卡体 3D、全息层、浮雕、版式
src/main.js           弹簧物理、指针光效、粒子礼花
assets/               生成的独立 SVG
vendor/               国徽原始素材
```

支持 `prefers-reduced-motion`（静态呈现）、键盘翻面（Tab + Enter/空格）。

## 说明

- 国徽原始矢量来自 [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:National_Emblem_of_the_People%27s_Republic_of_China.svg)（公有领域）。
- 本项目为个人节日贺卡练习。国旗、国徽图案的使用请遵循《国旗法》《国徽法》相关规定（不得用于商标、商业广告等）。
- License 建议选 MIT（代码），矢量素材遵循其原始授权。

