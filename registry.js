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
    medium: ["手写 HTML/CSS", "米色纸面", "手绘涂鸦"],
    aspect: 16 / 10,
    url: null,
    path: "uis/digital-garden/",
    live: "https://maggieappleton.com/",
    source: "https://maggieappleton.com/garden",
    note: "策展人注——学的是「把网站当花园」的心法：🌱🌿🌲 三档生长状态诚实标注、手绘圈注与纸面暖色的书卷气。点笔记可以翻土换状态。内容为原创习作，致敬 maggieappleton.com 的数字花园。",
    highlights: [
      { x: 34, y: 26, title: "手绘圈注", text: "SVG 一笔画出的椭圆，加载时像随手画上去的。" },
      { x: 30, y: 52, title: "诚实的生长状态", text: "幼苗 / 抽芽 / 常青——花园敢承认哪些笔记没写完。" },
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
    medium: ["手写 HTML/CSS", "复古暖色", "斜纹与套印"],
    aspect: 16 / 10,
    url: null,
    path: "uis/annual-redesign/",
    live: "https://lynnandtonic.com/",
    source: "https://lynnandtonic.com/2025/",
    note: "策展人注——学的是 Lynn Fisher 的年度重设计仪式感：把「版本」本身做成内容。十九罐「往年颜料」是原创的复古暖色变奏，点一罐，整页换装。致敬 lynnandtonic.com 第 19 版。",
    highlights: [
      { x: 22, y: 34, title: "套印 V19", text: "大字号加一层错位实色阴影，复古印刷的味道。" },
      { x: 45, y: 74, title: "十九罐颜料", text: "点任意一罐旧颜色，今年的房子就刷成那年的样子。" },
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
    medium: ["手写 HTML/JS", "奶油底色", "微交互"],
    aspect: 16 / 10,
    url: null,
    path: "uis/interactive-magic/",
    live: "https://www.joshwcomeau.com/",
    source: "https://www.joshwcomeau.com/",
    note: "策展人注——学的是 Josh Comeau 的「处处有回应」：奶油底上的弹性昼夜开关、一按就开花的按钮。魔法的要点不是炫技，是让访客忍不住再点一次。彩蛋为原创，致敬 joshwcomeau.com。",
    highlights: [
      { x: 88, y: 9, title: "弹性昼夜开关", text: "翻过去月亮出来，整页陪你换睡衣。" },
      { x: 18, y: 62, title: "开花按钮", text: "每次点按喷出一把星星花瓣，计数器还会吐槽。" },
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
    medium: ["手写 HTML/CSS", "蜜桃色", "厚阴影大按钮"],
    aspect: 16 / 10,
    url: null,
    path: "uis/peach-toys/",
    live: "https://meowni.ca/",
    source: "https://meowni.ca/",
    note: "策展人注——学的是 meowni.ca 的玩具精神：蜜桃底色、厚阴影大按钮、一本正经的胡说八道。「不要按这个按钮」按下去会发生一次小型奇迹。台词原创，致敬 meowni.ca 的怪奇快乐。",
    highlights: [
      { x: 88, y: 12, title: "一颗骄傲的桃", text: "悬停它会转个身——玩具箱里的东西都活得很自在。" },
      { x: 30, y: 55, title: "厚阴影大按钮", text: "按下去真的会物理下沉 6px，配一句胡说八道。" },
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
    medium: ["手写 HTML/CSS", "暖纸衬线", "大量留白"],
    aspect: 16 / 10,
    url: null,
    path: "uis/quiet-paper/",
    live: "https://frankchimero.com/",
    source: "https://frankchimero.com/essays/",
    note: "策展人注——学的是 Frank Chimero 的克制：暖纸、衬线、一根发丝线，除此之外什么都忍住不做。悬停随笔标题时那 12px 的位移，是全页唯一的动画。文章与引句原创，致敬 frankchimero.com。",
    highlights: [
      { x: 30, y: 45, title: "一行引句", text: "唯一加了重点号的半句话，是整页的语气所在。" },
      { x: 30, y: 76, title: "随笔目录", text: "悬停时整行右移 12px——克制的动画也可以很讲究。" },
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
