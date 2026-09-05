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
 *    zone    分区："create" 个人创作 | "collect" 收录他人（两区分开陈列）
 *    title   展签名称；titleEn 英文名
 *    year    年份；origin  来源（个人创造 / 收录）
 *    medium  材质 = 技术栈数组
 *    aspect  相框纵横比（宽/高，如 16/10）
 *    path    本地展品路径（如 "uis/demo/"，以 / 结尾）
 *    url     外部展品线上地址（path 与 url 二选一）
 *    embed   设为 false = 原站禁止被嵌（X-Frame-Options 等），
 *            馆外展出：总台摆馆牌封面，步入即新窗口打开源站
 *    live    展签上的「源站 ↗」链接，可省
 *    source  展签上的「源码 ↗」链接，可省
 *    note    策展人注：这件展品美在哪
 *    highlights  高光解剖：[{ x, y, title, text }]，x/y 为缩览上的
 *              百分比坐标，点按弹出「细看这里」标注，可省
 *    versions    版本史：[{ label, year, url, note }]，≥2 条才在馆内
 *              展示；url 可步入，省略 url 的版本以「修复中」凭证陈列
 * ============================================================ */

const EXHIBITS = [
  {
    id: "harry-homepage",
    zone: "create",
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
    versions: [
      {
        label: "Astro v2 · 现行版",
        year: "2026",
        url: "https://alidadei.github.io/",
        note: "三层渐进加载的宇宙，中英双语。",
      },
      {
        label: "Jekyll 学术主页",
        year: "早期",
        note: "academicpages 模板：论文、演讲、教学目录俱全。源码封存于仓库 nostalgia_history 分支，待修复后开放步入。",
      },
    ],
  },
  {
    id: "digital-garden",
    zone: "collect",
    no: "002",
    cn: "贰",
    title: "Maggie Appleton · 数字花园",
    titleEn: "maggieappleton.com",
    year: "2026",
    origin: "收录",
    medium: ["米色纸面", "手绘插图", "生长状态标注"],
    aspect: 16 / 10,
    url: "https://maggieappleton.com/",
    path: null,
    embed: false,
    live: "https://maggieappleton.com/",
    source: "https://maggieappleton.com/garden",
    note: "策展人注——「数字花园」的殿堂级样本：把笔记当植物养（幼苗/抽芽/常青三档生长状态诚实标注），米色纸面配手绘插图。原站设了 X-Frame-Options 禁止被嵌，故以馆外形式展出，点开展厅即达。",
  },
  {
    id: "annual-redesign",
    zone: "collect",
    no: "003",
    cn: "叁",
    title: "Lynn Fisher · 一年一重设计",
    titleEn: "lynnandtonic.com",
    year: "2026",
    origin: "收录",
    medium: ["米色 #e4e2d7", "墨 #111", "信号红 #ff3b3b", "light-dark()"],
    aspect: 16 / 10,
    url: "https://lynnandtonic.com/",
    path: null,
    live: "https://lynnandtonic.com/",
    source: "https://lynnandtonic.com/2025/",
    note: "策展人注——v.XIX 现行版原样展出：米色 #e4e2d7 配信号红 #ff3b3b，标题用手绘展示字体 Hubano-Rough。学的是 Lynn Fisher 的年度重设计仪式感——每年推倒重盖，旧版全部进档案供人凭吊。",
  },
  {
    id: "interactive-magic",
    zone: "collect",
    no: "004",
    cn: "肆",
    title: "Josh Comeau · 互动魔法",
    titleEn: "joshwcomeau.com",
    year: "2026",
    origin: "收录",
    medium: ["白底 #fff", "动作蓝 #4242fa", "处处微交互"],
    aspect: 16 / 10,
    url: "https://www.joshwcomeau.com/",
    path: null,
    live: "https://www.joshwcomeau.com/",
    source: "https://www.joshwcomeau.com/",
    note: "策展人注——程序员站天花板原样展出：白底、动作蓝 #4242fa，几乎每个元素都对访客有回应——开关会翻跟头，按钮会开花，文章卡会眨眼。学的是互动的分寸感：魔法不许变成噪音。",
  },
  {
    id: "peach-toys",
    zone: "collect",
    no: "005",
    cn: "伍",
    title: "Monica Dinculescu · 玩具桌",
    titleEn: "meowni.ca",
    year: "2026",
    origin: "收录",
    medium: ["近白纸底", "等宽正文", "换装强调色"],
    aspect: 16 / 10,
    url: "https://meowni.ca/",
    path: null,
    live: "https://meowni.ca/",
    source: "https://meowni.ca/",
    note: "策展人注——怪奇玩具风原样展出：近白纸底、通篇等宽字体、强调色整页换装（粉绿黄蓝品红，甚至有经典链接蓝 #0000a8），玩具们一本正经地胡说八道。小众到近乎行为艺术，快乐却非常具体。",
  },
  {
    id: "quiet-paper",
    zone: "collect",
    no: "006",
    cn: "陆",
    title: "Frank Chimero · 安静的纸面",
    titleEn: "frankchimero.com",
    year: "2026",
    origin: "收录",
    medium: ["灰绿 #eeeeee", "鼠尾草 #5e786d", "14px/Courier"],
    aspect: 16 / 10,
    url: "https://frankchimero.com/",
    path: null,
    live: "https://frankchimero.com/",
    source: "https://frankchimero.com/essays/",
    note: "策展人注——老牌设计师的随笔之家原样展出：灰绿 #eeeeee、14px 基准字号、Courier 标签、鼠尾草 #5e786d 强调。学的是克制——把所有想加的动画都忍回去，安静本身就是气质。",
  },
];

/* ============================================================
 * 特展 · 主题展线
 * ------------------------------------------------------------
 * id      稳定 ID，地址为 #/exhibition/<id>
 * no      展线编号（如 "特001"）
 * title   展线名称；preface 前言；closing 闭幕词（可省，有默认）
 * items   展线包含的展品 id，按观展顺序排列
 * ============================================================ */

const EXHIBITIONS = [
  {
    id: "opening",
    no: "特001",
    title: "开馆首展 · 一人宇宙",
    preface: "一个人，一颗星球，一片暖棕米的夜空。首展只此一件——不是为了少，而是为了把一件东西看仔细。按 → 沿展线前行，Esc 随时离馆。",
    closing: "首展到此。记得抬头——馆顶也是星空。",
    items: ["harry-homepage"],
  },
  {
    id: "studies",
    no: "特002",
    title: "他山之石 · 风格习作展",
    preface: "他山之石，可以攻玉。本展线原样展出五座馆外名园——版式、配色、小心思，都是现成的老师。按 → 沿展线前行，Esc 随时离馆。",
    closing: "展线到此。看完别人的院子，回头修自己的。",
    items: ["digital-garden", "annual-redesign", "interactive-magic", "peach-toys", "quiet-paper"],
  },
];
