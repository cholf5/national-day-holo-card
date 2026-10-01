#!/usr/bin/env python3
"""国庆典藏卡构建脚本。

1. 按国家标准 (GB 12982) 的制图参数精确生成国旗 SVG -> assets/flag.svg
2. 将国徽 SVG 重着色为金属金浮雕 -> assets/emblem-gold.svg
3. 将两份矢量图内联进 src/template.html -> index.html
"""
import math
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))


# ---------------------------------------------------------------- 国旗
def star_path(cx: float, cy: float, r: float, phi: float) -> str:
    """五角星路径。phi 为星尖指向角（SVG 坐标系，y 向下）。"""
    ri = r * math.sin(math.pi / 10) / math.sin(3 * math.pi / 10)
    pts = []
    for i in range(10):
        rad = r if i % 2 == 0 else ri
        a = phi + i * math.pi / 5
        pts.append(f"{cx + rad * math.cos(a):.2f},{cy + rad * math.sin(a):.2f}")
    return "M" + " L".join(pts) + " Z"


def build_flag() -> str:
    S = 100.0  # 30x20 官方网格 -> 3000x2000
    paths = [star_path(5 * S, 5 * S, 3 * S, -math.pi / 2)]
    # 四颗小星圆心 (10,2) (12,4) (12,7) (10,9)，星尖各对准大星圆心 (5,5)
    for cx, cy in [(10, 2), (12, 4), (12, 7), (10, 9)]:
        phi = math.atan2(5 - cy, 5 - cx)
        paths.append(star_path(cx * S, cy * S, S, phi))
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3000 2000" '
        'preserveAspectRatio="xMidYMid slice" role="img" aria-label="五星红旗">\n'
        '  <rect width="3000" height="2000" fill="#DE2910"/>\n'
        '  <g fill="#FFDE00">\n    '
        + "\n    ".join(f'<path d="{d}"/>' for d in paths)
        + "\n  </g>\n</svg>"
    )


# ---------------------------------------------------------------- 国徽
GRADIENT_DEFS = """<defs>
  <linearGradient id="goldMetal" gradientUnits="userSpaceOnUse"
      x1="0" y1="-80" x2="0" y2="860" gradientTransform="rotate(14 358.82 389.6)">
    <stop offset="0"    stop-color="#ffe9a0"/>
    <stop offset=".1"   stop-color="#f7c93e"/>
    <stop offset=".2"   stop-color="#a86e08"/>
    <stop offset=".3"   stop-color="#ffd23e"/>
    <stop offset=".4"   stop-color="#fffbe8"/>
    <stop offset=".5"   stop-color="#f0b418"/>
    <stop offset=".6"   stop-color="#c07f0a"/>
    <stop offset=".7"   stop-color="#ffdf62"/>
    <stop offset=".8"   stop-color="#fff3b8"/>
    <stop offset=".9"   stop-color="#d99b17"/>
    <stop offset="1"    stop-color="#a9750c"/>
  </linearGradient>
  <radialGradient id="bronzeDeep" gradientUnits="userSpaceOnUse"
      cx="358.82" cy="330" r="480">
    <stop offset="0"   stop-color="#f6c854"/>
    <stop offset=".45" stop-color="#d89e22"/>
    <stop offset=".78" stop-color="#9c6a0e"/>
    <stop offset="1"   stop-color="#6b4608"/>
  </radialGradient>
  <!-- 底部绶带：纵向明暗交替的褶皱带，光来自上方 -->
  <linearGradient id="ribbonGold" gradientUnits="userSpaceOnUse"
      x1="300" y1="530" x2="430" y2="800">
    <stop offset="0"    stop-color="#ffe59a"/>
    <stop offset=".14"  stop-color="#f2c14e"/>
    <stop offset=".28"  stop-color="#a87208"/>
    <stop offset=".4"   stop-color="#ffd85e"/>
    <stop offset=".52"  stop-color="#8f5f08"/>
    <stop offset=".64"  stop-color="#f5c951"/>
    <stop offset=".78"  stop-color="#c08414"/>
    <stop offset=".9"   stop-color="#8a5c0a"/>
    <stop offset="1"    stop-color="#6b4608"/>
  </linearGradient>
  <!-- 浮雕：alpha 通道作高度图，左上光源的漫反射 + 锐利星芒高光（sRGB 色彩空间保住金色饱和度） -->
  <filter id="relief" x="-8%" y="-8%" width="116%" height="116%"
      color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="bump"/>
    <feDiffuseLighting in="bump" surfaceScale="12" diffuseConstant="1.05"
        lighting-color="#ffffff" result="diff">
      <feDistantLight azimuth="230" elevation="55"/>
    </feDiffuseLighting>
    <feSpecularLighting in="bump" surfaceScale="12" specularConstant="0.85"
        specularExponent="45" lighting-color="#fff3c0" result="spec">
      <feDistantLight azimuth="230" elevation="38"/>
    </feSpecularLighting>
    <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>
    <feComposite in="diff" in2="SourceGraphic" operator="arithmetic"
        k1="1" k2="0" k3="0" k4="0" result="shaded"/>
    <feComposite in="shaded" in2="specIn" operator="arithmetic"
        k1="0" k2="1" k3="1" k4="0" result="lit"/>
    <feColorMatrix in="lit" type="saturate" values="1.3"/>
  </filter>
</defs>"""


def build_emblem() -> str:
    src = os.path.join(ROOT, "vendor", "emblem-original.svg")
    with open(src, encoding="utf-8") as f:
        s = f.read()

    # 定位根 <svg ...> 标签的真实结尾（注意不能用第一个 '>'，会撞上 <?xml ?> 声明）
    m = re.search(r"<svg[^>]*>", s)
    inner = s[m.end(): s.rindex("</svg>")]
    # 去掉注释与 inkscape/sodipodi 私有属性
    inner = re.sub(r"<!--.*?-->", "", inner, flags=re.S)
    inner = re.sub(r'\s(?:inkscape|sodipodi):[\w-]+="[^"]*"', "", inner)
    # 金属化重着色。红色部件分两类（源自对 vendor 文件的逐件定位）：
    #   - 背景大圆盘：唯一一个 <ellipse>（viewBox 中央 ~539x539）→ 径向穹顶渐变
    #   - 底部绶带家族：6 片 <path>（左右垂尾 / 横向帘带 / 中央绶结 / 两条斜帔）→ 纵向褶皱带渐变
    def _recolor_red(m: "re.Match[str]") -> str:
        tag = m.group(0)
        if "fill:#de2910" not in tag:
            return tag
        grad = "bronzeDeep" if tag.lstrip().startswith("<ellipse") else "ribbonGold"
        return tag.replace("fill:#de2910", f"fill:url(#{grad})")

    inner = re.sub(r"<(?:path|ellipse)\b[^>]*>", _recolor_red, inner)
    inner = inner.replace("fill:#ffde00", "fill:url(#goldMetal)")
    inner = inner.replace("stroke:#000000", "stroke:#33200a")
    inner = inner.replace("stroke:black", "stroke:#33200a")
    inner = inner.replace("fill:#FEFEFE", "fill:#ffe9a8")

    root = ('<svg xmlns="http://www.w3.org/2000/svg" '
            'viewBox="0 0 717.64375 779.19284" fill-rule="evenodd" '
            'class="emblem-svg" role="img" aria-label="中华人民共和国国徽">')
    return root + GRADIENT_DEFS + '<g filter="url(#relief)">' + inner + "</g></svg>"


# ---------------------------------------------------------------- 组装
def build_html(flag: str, emblem: str) -> str:
    import time
    with open(os.path.join(ROOT, "src", "template.html"), encoding="utf-8") as f:
        html = f.read()
    html = html.replace("<!--INLINE:FLAG-->", flag)
    html = html.replace("<!--INLINE:EMBLEM-->", emblem)
    # 时间戳缓存穿透：本地反复改版时避免浏览器用旧的 css/js
    stamp = str(int(time.time()))
    html = html.replace('href="style.css"', f'href="style.css?v={stamp}"')
    html = html.replace('src="main.js"', f'src="main.js?v={stamp}"')
    return html


def main() -> None:
    import shutil
    flag = build_flag()
    emblem = build_emblem()
    with open(os.path.join(ROOT, "assets", "flag.svg"), "w", encoding="utf-8") as f:
        f.write(flag)
    with open(os.path.join(ROOT, "assets", "emblem-gold.svg"), "w", encoding="utf-8") as f:
        f.write(emblem)
    shutil.copy(os.path.join(ROOT, "src", "style.css"), os.path.join(ROOT, "style.css"))
    shutil.copy(os.path.join(ROOT, "src", "main.js"), os.path.join(ROOT, "main.js"))
    with open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8") as f:
        f.write(build_html(flag, emblem))
    print(f"flag.svg    {len(flag):>8,} bytes")
    print(f"emblem-gold {len(emblem):>8,} bytes")
    print("index.html / style.css / main.js  generated")


if __name__ == "__main__":
    main()
