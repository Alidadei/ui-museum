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
 *    versions    版本史：[{ label, year, url, note }]，≥2 条才在馆内
 *              展示；url 可步入，省略 url 的版本以「修复中」凭证陈列
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
    no: "002",
    cn: "贰",
    title: "数字花园 · 风格习作",
    titleEn: "Digital Garden, a study",
    year: "2026",
    origin: "致敬习作",
    medium: ["手写 HTML/CSS", "奶油 #f6f5f1", "Canela→Georgia", "五彩强调"],
    aspect: 16 / 10,
    url: null,
    path: "uis/digital-garden/",
    live: "https://maggieappleton.com/",
    source: "https://maggieappleton.com/garden",
    note: "策展人注——高保真习作：令牌直接抓取自原站线上 CSS（奶油 #f6f5f1、墨 #353534、绯红 #e85aab、海蓝 #008ba3），学的是「把网站当花园」的心法与 Canela 书卷衬线气质。商业字体以 Georgia 近似，内容原创，致敬 maggieappleton.com。",
    highlights: [
      { x: 34, y: 30, title: "五彩导航", text: "五个栏目五种强调色，悬停时才亮出各自的 badge 色。" },
      { x: 32, y: 58, title: "诚实的生长状态", text: "常青 / 抽芽 / 幼苗——花园敢承认哪些笔记没写完。" },
    ],
  },
  {
    id: "annual-redesign",
    no: "003",
    cn: "叁",
    title: "一年一重设计 · 风格习作",
    titleEn: "Annual Redesign, a study",
    year: "2026",
    origin: "致敬习作",
    medium: ["手写 HTML/CSS", "米色 #e4e2d7", "信号红 #ff3b3b", "light-dark()"],
    aspect: 16 / 10,
    url: null,
    path: "uis/annual-redesign/",
    live: "https://lynnandtonic.com/",
    source: "https://lynnandtonic.com/2025/",
    note: "策展人注——高保真习作：令牌抓取自原站 v19 的 main.css（米色 #e4e2d7、墨 #111、信号红 #ff3b3b、六档 rem 字阶，连 light-dark() 昼夜机制也照抄）。学的是 Lynn Fisher 的年度重设计仪式感。商业展示字体 Hubano-Rough 以 Impact 近似，内容原创。",
    highlights: [
      { x: 20, y: 16, title: "6rem 粗野标题", text: "Hubano-Rough 的海报气质以 Impact 近似，两行断行同原站。" },
      { x: 35, y: 62, title: "v.XIX 档案表", text: "点线边框 + 米红黑三色——第 19 版的整套配方都在这。" },
    ],
  },
  {
    id: "interactive-magic",
    no: "004",
    cn: "肆",
    title: "互动小魔法 · 风格习作",
    titleEn: "Interactive Magic, a study",
    year: "2026",
    origin: "致敬习作",
    medium: ["手写 HTML/JS", "白底 #fff", "动作蓝 #4242fa", "微交互"],
    aspect: 16 / 10,
    url: null,
    path: "uis/interactive-magic/",
    live: "https://www.joshwcomeau.com/",
    source: "https://www.joshwcomeau.com/",
    note: "策展人注——高保真习作：令牌抓取自原站线上 CSS（白底 #fff、动作蓝 #4242fa、代码底 #1a1f23），学的是 Josh Comeau 的「处处有回应」：悬停会倾斜的文章卡、一按撒星星的按钮。Wotfard 以系统无衬线近似，彩蛋与文字原创。",
    highlights: [
      { x: 42, y: 66, title: "撒星星按钮", text: "动作蓝 #4242fa 实底 + 悬浮投影，按下喷出一把星星。" },
      { x: 50, y: 58, title: "会倾斜的文章卡", text: "悬停上浮 4px 再歪 0.4 度——礼貌的魔法。" },
    ],
  },
  {
    id: "peach-toys",
    no: "005",
    cn: "伍",
    title: "蜜桃玩具箱 · 风格习作",
    titleEn: "Peach Toys, a study",
    year: "2026",
    origin: "致敬习作",
    medium: ["手写 HTML/CSS", "等宽正文", "近白纸底", "换装强调色"],
    aspect: 16 / 10,
    url: null,
    path: "uis/peach-toys/",
    live: "https://meowni.ca/",
    source: "https://meowni.ca/",
    note: "策展人注——高保真习作：令牌抓取自原站线上 CSS（近白纸底 oklch(0.99 0.004 95)、等宽正文、h1 clamp(27px,4vw,36px)），学的是 meowni.ca 的玩具精神：整页强调色可换装（粉/绿/黄/蓝/品红/经典蓝 #0000a8），玩具一本正经地胡说八道。台词原创。",
    highlights: [
      { x: 24, y: 30, title: "换装强调色", text: "六颗圆点对应原站的六种主题色，一点全页换装。" },
      { x: 35, y: 56, title: "等宽玩具列表", text: "Roboto Mono 的系统近似 + 描边卡片，按下会承认自己是玩具。" },
    ],
  },
  {
    id: "quiet-paper",
    no: "006",
    cn: "陆",
    title: "安静的纸面 · 风格习作",
    titleEn: "Quiet Paper, a study",
    year: "2026",
    origin: "致敬习作",
    medium: ["手写 HTML/CSS", "灰绿 #eeeeee", "鼠尾草 #5e786d", "14px/Courier"],
    aspect: 16 / 10,
    url: null,
    path: "uis/quiet-paper/",
    live: "https://frankchimero.com/",
    source: "https://frankchimero.com/essays/",
    note: "策展人注——高保真习作：令牌抓取自原站 styles.css（灰绿 #eeeeee、墨 #2f3432、鼠尾草 #5e786d、14px 基准、Courier 标签），学的是 Frank Chimero 的克制：整页只允许一次悬停位移。文章原创，致敬 frankchimero.com。",
    highlights: [
      { x: 30, y: 34, title: "灰绿的脾气", text: "#eeeeee 纸面 + 鼠尾草强调——原站的全部情绪就这两个数。" },
      { x: 30, y: 62, title: "14px 的定力", text: "原站基准字号只有 14px；Courier 标签是版面唯一的装饰。" },
    ],
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
    preface: "临摹是老手艺：先学走，再学跑，最后学会像自己。本展线挂出五份原创风格习作——拆解五位馆外高手的招牌手法，各写成一页答卷。按 → 沿展线看展，Esc 随时离馆。",
    closing: "习作到此。手艺学完要忘掉一半，剩下的那半才是自己的。",
    items: ["digital-garden", "annual-redesign", "interactive-magic", "peach-toys", "quiet-paper"],
  },
];
