# 界面收藏馆 · Interface Museum

> 收录并展示我认为美观的、平时个人创造的 UI 页面。
> 每一件展品都是独立隔离的一套 UI；有一个展示总台，点击展品，整个网页就变成对应的 UI。
>
> 线上：<https://alidadei.github.io/ui-museum/>

零构建纯静态（无 npm、无框架、无打包器、无外部字体），手工搓成。

## 馆内功能

- **高光解剖**：缩览上的金色脉动热区，点按弹出「细看这里」标注（registry 的 `highlights` 字段）
- **巡礼集章**：步入过的展品自动盖章（localStorage），侧栏集章，集满成「荣誉访客」
- **特展展线**：`#/exhibition/<id>` 主题巡游——前言幕布 → 逐件观展（←/→）→ 闭幕（registry 的 `EXHIBITIONS`）
- **版本史专柜**：同一作品的多版本并排，可步入；无法活体展出的以「修复中」凭证陈列（registry 的 `versions` 字段）
- **库房公开化**：`shared/` 原子在[库房陈列室](shared/)公开展出——编号、说明、用法、现场演示、源码查看/下载，随仓库开放拷贝；馆内代码也优先领用库房原子（如色票、FLIP 过渡）

- **库房公开化**：`shared/` 原子在[库房陈列室](shared/)公开展出——编号、说明、用法、现场演示、源码查看/下载，随仓库开放拷贝；馆内代码也优先领用库房原子（如色票、FLIP 过渡）
- **策展后台**：[admin/](admin/) 可视化编辑展签名称、策展人注、材质等介绍内容，一键发布（需自己的 GitHub 令牌，只存浏览器）

### 策展后台使用

1. 打开 [admin/](admin/)（线上：`https://alidadei.github.io/ui-museum/admin/`）；
2. 创建一个 Fine-grained PAT：GitHub → Settings → Developer settings → 仅选 ui-museum 仓库 → Permissions 给 **Contents: Read and write**；
3. 令牌粘贴进后台（只存你浏览器的 localStorage），选展品 → 改字段 → 「发布到 GitHub」；
4. 约 1 分钟后 Pages 自动重建，全网生效。不想配令牌也能改和下载 `registry.js`，手动提交同样有效。

## 展陈方式

- **总台**（`index.html`）：左侧导览 + 馆规，右侧展厅。展品以「活的缩览」挂在相框里
  （iframe 以 1280px 虚拟视口等比缩小，永远是真实桌面版式，非截图）。
- **步入展厅**：点击相框 / `Enter`，同一枚 iframe 从相框 FLIP 放大到全屏——不重载，
  展品里的 3D 场景连续存活，整个网页就变成了那套 UI。`Esc` / `← 返回总台` 归馆。
- **路由**：`#/` 总台，`#/exhibit/<id>` 观展态。刷新、直链、浏览器前进后退均可。

## 目录结构与数据约定

```
ui-museum/
├── index.html        展示总台
├── assets/           总台自身的样式与脚本（hub.css / hub.js）
├── registry.js       登记册：所有展品的名录与展签信息
├── uis/              每套 UI 一个独立目录，完全自包含，互不依赖
│   └── <slug>/       （index.html + 私有 css/js/资产）
└── shared/           馆藏库房：跨展品复用的原子资源专用目录，公开陈列
    └── <atom>/       （如某个 three.js 场景；总台也在此领用，见 shared/index.html）
```

**馆规三条**：

1. 每件展品自成世界——各居 `uis/` 一室，互不惊扰（样式、脚本、资产全部私有）。
2. 重叠的原子资源藏入库房——放 `shared/<atom>/`，展品内以 `../../shared/<atom>/` 相对路径引用。
3. 新藏品先挂号——在 `registry.js` 的 `EXHIBITS` 数组登记一条（字段说明见该文件头部注释）。

## 如何收录一套新 UI

**本地展品**（推荐，完全自包含）：

1. 新建 `uis/<slug>/index.html`，把整套 UI 放进去（可引用 `shared/` 原子）；
2. 在 `registry.js` 登记：填 `path: "uis/<slug>/"`（`path` 与 `url` 二选一）；
3. 刷新总台即开展。

**外部展品**（以源站形式展出，如第一件展品）：不建目录，登记时填 `url` 即可。

## 本地预览

```bash
cd ui-museum
python -m http.server 8123     # 或 npx http-server -p 8123
# 打开 http://localhost:8123
```

直接双击 index.html 也能看，但部分浏览器对 file:// 下的 iframe 有限制，建议起本地服务。

## 部署

推送到 `main` 即发布（仓库 Settings → Pages → Deploy from branch `main` / root）。
本仓库与个人站 `alidadei.github.io` 的 Pages 构建相互独立，互不影响。

---

个人作品，保留所有权利。
