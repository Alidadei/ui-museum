/* ============================================================
 * 馆藏库房 · 原子登记册
 * ------------------------------------------------------------
 * 新入库一个原子：
 *   1) 在 shared/<atom>/ 建目录（自包含 + README 说明用法）
 *   2) 在下方 ATOMS 数组登记一条：
 *      id      稳定 ID（与目录名一致）
 *      no      入库编号
 *      name    展示名
 *      desc    一句话说明
 *      status  "in-use"（馆内在用）| "ready"（待领用）
 *      files   文件名数组（相对 shared/<atom>/）
 *      usage   引入方式（纯文本）
 *   3) 若陈列页要配现场演示，在 shared/index.html 的 DEMOS 里
 *      挂一个同 id 的渲染函数
 * ============================================================ */

const ATOMS = [
  {
    id: "earth-tokens",
    no: "原001",
    name: "夯土色票 · earth-tokens",
    desc: "界面收藏馆全套土色系设计令牌：暗夯土底、赭金、印章红、相框土黑与两级发丝线。一处定义，总台与展品共用同一片土壤。",
    status: "in-use",
    files: ["tokens.css"],
    usage: '<link rel="stylesheet" href="shared/earth-tokens/tokens.css"> 之后即可 var(--bg)、var(--gold)……',
  },
  {
    id: "flip-step",
    no: "原002",
    name: "步入过渡 · flip-step",
    desc: "零依赖 FLIP 过渡：让同一元素在两个矩形之间连续飞行，放大缩小不重载、不跳切。总台的「步入展厅」用的就是它。",
    status: "in-use",
    files: ["flip.js"],
    usage: '<script src="shared/flip-step/flip.js"></script> 之后调用 flipFit(el, firstRect, lastRect, { duration, done })',
  },
];
