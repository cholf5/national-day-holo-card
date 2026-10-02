#!/usr/bin/env python3
"""国庆典藏卡构建脚本。

1. 按国家标准 (GB 12982) 的制图参数精确生成国旗 SVG -> assets/flag.svg
2. 将国徽 SVG 重着色为金属金浮雕 -> assets/emblem-gold.svg
3. 生成 PWA 图标（纯标准库光栅化）-> assets/*.png 与 manifest.webmanifest
4. 将两份矢量图内联进 src/template.html -> index.html，并输出 style.css / main.js / sw.js
"""
import math
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))


# ---------------------------------------------------------------- 国旗
def star_vertices(cx: float, cy: float, r: float, phi: float) -> list:
    """五角星顶点。phi 为星尖指向角（SVG 坐标系，y 向下）。"""
    ri = r * math.sin(math.pi / 10) / math.sin(3 * math.pi / 10)
    return [
        (cx + (r if i % 2 == 0 else ri) * math.cos(phi + i * math.pi / 5),
         cy + (r if i % 2 == 0 else ri) * math.sin(phi + i * math.pi / 5))
        for i in range(10)
    ]


def star_path(cx: float, cy: float, r: float, phi: float) -> str:
    pts = [f"{x:.2f},{y:.2f}" for x, y in star_vertices(cx, cy, r, phi)]
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


# ---------------------------------------------------------------- PWA 图标与清单
ICON_RED = (0xDE, 0x29, 0x10)    # 旗面红
ICON_GOLD = (0xFF, 0xDE, 0x00)   # 五星黄


def icon_stars() -> list:
    """星组多边形（官方 30x20 网格坐标，与 build_flag 同源）：
    大星 r=3 圆心 (5,5)，四颗小星 r=1，星尖各指向大星圆心。"""
    polys = [star_vertices(5, 5, 3, -math.pi / 2)]
    for cx, cy in [(10, 2), (12, 4), (12, 7), (10, 9)]:
        polys.append(star_vertices(cx, cy, 1, math.atan2(5 - cy, 5 - cx)))
    return polys


def write_png(path: str, size: int, rgb: bytes) -> None:
    """最小 PNG 编码器（8bit RGB、0 号过滤行），纯标准库、零依赖。"""
    import struct
    import zlib
    raw = b"".join(b"\x00" + rgb[y * size * 3:(y + 1) * size * 3] for y in range(size))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)


def build_icon(path: str, size: int, span: float, ss: int = 3) -> None:
    """纯标准库光栅化五角星图标：旗面红底，金黄星组居中、占画布 span 宽。
    ss 倍超采样 + 盒滤波抗锯齿；maskable 图标用更小的 span 躲启动器裁切安全区。"""
    w = h = size * ss
    polys = icon_stars()
    xs = [x for poly in polys for x, _ in poly]
    ys = [y for poly in polys for _, y in poly]
    k = w * span / (max(xs) - min(xs))            # 网格单位 -> 超采样像素
    ox = w / 2 - (min(xs) + max(xs)) / 2 * k
    oy = h / 2 - (min(ys) + max(ys)) / 2 * k

    # 逐星扫描线填充（奇偶规则）到掩码
    mask = bytearray(w * h)
    for poly in polys:
        vx = [ox + x * k for x, _ in poly]
        vy = [oy + y * k for _, y in poly]
        n = len(poly)
        for row in range(h):
            yc = row + 0.5
            cross = sorted(
                vx[i] + (yc - vy[i]) * (vx[(i + 1) % n] - vx[i])
                / (vy[(i + 1) % n] - vy[i])
                for i in range(n)
                if (vy[i] <= yc < vy[(i + 1) % n]) or (vy[(i + 1) % n] <= yc < vy[i])
            )
            if not cross:
                continue
            base = row * w
            for a, b in zip(cross[::2], cross[1::2]):
                lo = max(0, math.ceil(a - 0.5))
                hi = min(w - 1, math.floor(b - 0.5))
                if hi >= lo:
                    mask[base + lo:base + hi + 1] = b"\xff" * (hi - lo + 1)

    # 盒滤波降采样出覆盖率，红金两色按覆盖度插值
    lut = [
        bytes(int(ICON_RED[c] + (ICON_GOLD[c] - ICON_RED[c]) * a / 255 + 0.5)
              for c in range(3))
        for a in range(256)
    ]
    rgb = bytearray(size * size * 3)
    for oy2 in range(size):
        for ox2 in range(size):
            cov = 0
            for sy in range(oy2 * ss, (oy2 + 1) * ss):
                base = sy * w + ox2 * ss
                cov += sum(mask[base:base + ss])
            i = (oy2 * size + ox2) * 3
            rgb[i:i + 3] = lut[(cov + ss * ss // 2) // (ss * ss)]
    write_png(path, size, bytes(rgb))


def build_manifest() -> str:
    """PWA 清单。start_url/scope/图标全部用相对路径，
    兼容 GitHub Pages 项目页的子路径部署（/仓库名/）。"""
    import json
    return json.dumps(
        {
            "name": "国庆典藏卡",
            "short_name": "国庆典藏卡",
            "description": "五星红旗 × 金属国徽 3D 全息典藏卡：弹簧倾斜、点击翻面、全息光效。",
            "lang": "zh-CN",
            "start_url": "./",
            "scope": "./",
            "display": "standalone",
            "background_color": "#200304",
            "theme_color": "#3a0808",
            "icons": [
                {"src": "assets/icon-192.png", "sizes": "192x192",
                 "type": "image/png", "purpose": "any"},
                {"src": "assets/icon-512.png", "sizes": "512x512",
                 "type": "image/png", "purpose": "any"},
                {"src": "assets/icon-maskable-192.png", "sizes": "192x192",
                 "type": "image/png", "purpose": "maskable"},
                {"src": "assets/icon-maskable-512.png", "sizes": "512x512",
                 "type": "image/png", "purpose": "maskable"},
            ],
        },
        ensure_ascii=False, indent=2,
    ) + "\n"


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
    with open(os.path.join(ROOT, "assets", "flag.svg"), "w", encoding="utf-8", newline="\n") as f:
        f.write(flag)
    with open(os.path.join(ROOT, "assets", "emblem-gold.svg"), "w", encoding="utf-8", newline="\n") as f:
        f.write(emblem)
    shutil.copy(os.path.join(ROOT, "src", "style.css"), os.path.join(ROOT, "style.css"))
    shutil.copy(os.path.join(ROOT, "src", "main.js"), os.path.join(ROOT, "main.js"))
    shutil.copy(os.path.join(ROOT, "src", "sw.js"), os.path.join(ROOT, "sw.js"))
    with open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8", newline="\n") as f:
        f.write(build_html(flag, emblem))

    # PWA：五张方形图标（span 为星组占画布宽度比例；maskable 留足裁切安全区）
    for name, size, span in [
        ("icon-192.png", 192, 0.62),
        ("icon-512.png", 512, 0.62),
        ("icon-maskable-192.png", 192, 0.55),
        ("icon-maskable-512.png", 512, 0.55),
        ("apple-touch-icon.png", 180, 0.62),
    ]:
        build_icon(os.path.join(ROOT, "assets", name), size, span)
    with open(os.path.join(ROOT, "manifest.webmanifest"), "w", encoding="utf-8", newline="\n") as f:
        f.write(build_manifest())

    print(f"flag.svg    {len(flag):>8,} bytes")
    print(f"emblem-gold {len(emblem):>8,} bytes")
    print("index.html / style.css / main.js / sw.js  generated")
    print("assets icons (192/512/maskable/apple-touch) + manifest.webmanifest  generated")


if __name__ == "__main__":
    main()
