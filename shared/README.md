# shared/ · 馆藏库房（公开陈列室）

跨展品复用的**原子化资源**统一存放于此：某个 three.js 场景、一套色票、一个过渡函数……
**线上陈列室就是本目录的 [index.html](index.html)**——每个原子有编号、说明、用法、源码查看/下载与现场演示。

## 约定

- 每个原子一个子目录：`shared/three-planet/`、`shared/glass-card/` …，**自包含**并附 README 说明用途、参数与来源
- 展品内引用方式（位于 `uis/<slug>/` 时）：`../../shared/<atom>/…`
- 原子升级保持向后兼容；破坏性变更请新开版本目录（如 `glass-card-v2/`），旧展品不受影响
- 入库登记：在 `atoms.js` 的 `ATOMS` 数组加一条；要配现场演示就在 `index.html` 的 DEMOS 段挂一个同 id 渲染函数
- 禁止 CDN 外链——库房里的东西必须随仓库走（国内加载考虑）

## 当前库存

| 编号 | 原子 | 状态 | 说明 |
|---|---|---|---|
| 原001 | [earth-tokens](earth-tokens/tokens.css) | 馆内在用 | 全套土色系设计令牌，总台经 `@import` 领用 |
| 原002 | [flip-step](flip-step/flip.js) | 馆内在用 | 零依赖 FLIP 过渡，总台「步入展厅」经 `<script>` 领用 |

领用、演示与下载一律走[陈列室页面](index.html)。
