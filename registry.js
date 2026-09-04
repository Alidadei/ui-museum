/* ============================================================
 * 界面收藏馆 · 登记册
 * ------------------------------------------------------------
 * 收录新展品分两步：
 *
 * 1) 备展（二选一）
 *    · 本地展品：在 uis/<slug>/ 下建一套完全自包含的页面
 *      （index.html + 私有 css/js/资产）。需要跨展品复用的原子
 *      （如某个 three.js 场景）放 shared/<atom>/ 专柜，从展品内
 *      以 ../../shared/<atom>/ 相对路径引用。
 *    · 外部展品：不必建目录，直接填线上 url（如以源站形式展出）。
 *
 * 2) 挂号：在下方 EXHIBITS 数组里加一条。字段说明：
 *    id      稳定 ID，出现在地址 #/exhibit/<id>
 *    no      馆藏编号（字符串，如 "002"）
 *    cn      展位汉字（展厅背景水印，如 "贰"）
 *    title   展签名称；titleEn 英文名
 *    year    年份；origin  来源（个人创造 / 收录）
 *    medium  材质 = 技术栈数组
 *    aspect  相框纵横比（宽/高，如 16/10）
 *    path    本地展品路径（如 "uis/demo/"，以 / 结尾）
 *    url     外部展品线上地址（path 与 url 二选一）
 *    live    展签上的「源站 ↗」链接，可省
 *    source  展签上的「源码 ↗」链接，可省
 *    note    策展人注：这件展品美在哪
 *    highlights  高光解剖：[{ x, y, title, text }]，x/y 为缩览上的
 *              百分比坐标，点按弹出「细看这里」标注，可省
 *    versions    版本史：[{ label, year, url, loan }]，loan=true 表示
 *              借展（如互联网档案馆快照），≥2 条才在馆内展示，可省
 * ============================================================ */

const EXHIBITS = [
  {
    id: "harry-homepage",
    no: "001",
    cn: "壹",
    title: "Harry Yu 的个人网站",
    titleEn: "Personal Website",
    year: "2026",
    origin: "个人创造",
    medium: ["Astro", "React 19", "Three.js", "Tailwind CSS 4"],
    aspect: 16 / 10,
    url: "https://alidadei.github.io/",
    path: null,
    live: "https://alidadei.github.io/",
    source: "https://github.com/Alidadei/alidadei.github.io",
    note: "策展人注——首页是一场三层渐进的开幕：2D 星空即刻到场，浏览器空闲时 3D 星球缓缓升起，最后 SunArc 天空弧光淡入。玻璃质感卡片浮在暖棕米色的宇宙上，中英双语、KaTeX、RSS 一应俱全。技术不喧哗，只负责氛围。",
    highlights: [
      { x: 24, y: 9, title: "毛玻璃仪表台", text: "导航浮在星空上，backdrop blur 只让光斑柔和地透出来。" },
      { x: 50, y: 44, title: "会呼吸的星球", text: "3D 星球等浏览器空闲时才升起——性能与氛围互相成全。" },
      { x: 38, y: 78, title: "暖棕米的宇宙", text: "玻璃卡片把中文排版泡在暖光里，信息密度再高也不吵。" },
    ],
  },
];
