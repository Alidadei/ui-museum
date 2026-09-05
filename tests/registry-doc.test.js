/* registry 外科手术核心的回归测试：node tests/registry-doc.test.js */
const fs = require("fs");
const path = require("path");
const RegistryDoc = require("../admin/admin-core.js");

const text = fs.readFileSync(path.join(__dirname, "../registry.js"), "utf8");
let ok = true;
const check = (n, c) => { console.log((c ? "✓" : "✗") + " " + n); if (!c) ok = false; };

// 1) 解析：六件展品都被定位
const doc = RegistryDoc.parse(text);
const ids = doc.entries.map((e) => RegistryDoc.entryId(e.slice));
check("解析出 6 件展品: " + ids.join(","), ids.length === 6 && ids[0] === "harry-homepage");

// 2) 空编辑回写：必须与原文件逐字节一致
check("空编辑回写逐字节一致", RegistryDoc.applyEdits(text, []) === text);

// 3) 读字段
const dEntry = doc.entries.find((e) => RegistryDoc.entryId(e.slice) === "digital-garden");
check("读 note 字段", (RegistryDoc.getField(dEntry.slice, "note") || "").includes("殿堂级样本"));
check("读 title 字段", RegistryDoc.getField(dEntry.slice, "title") === "Maggie Appleton · 数字花园");

// 4) 改字段：只动目标块，其余字节不变
const newNote = "策展人注（测试改写）——含引号”也不怕，换行 也会被折叠。";
const newSlice = RegistryDoc.setField(dEntry.slice, "note", newNote);
const newText = RegistryDoc.applyEdits(text, [{ start: dEntry.start, end: dEntry.end, text: newSlice }]);
check("改写生效且旧文本其余部分一致", newText !== text && newText.includes(newNote));
check("未编辑的 №001 块逐字节不变", RegistryDoc.applyEdits(text, [{ start: dEntry.start, end: dEntry.end, text: newSlice }])
  .includes(RegistryDoc.getField(doc.entries[0].slice, "note")));

// 5) 新全文仍是合法 JS，且数据正确
try {
  const f = new Function(newText + "; return EXHIBITS.find(x=>x.id==='digital-garden').note;");
  check("改写后 registry.js 可执行且 note 已更新", f() === newNote);
} catch (e) { check("改写后 registry.js 可执行: " + e.message, false); }

// 6) 清洗规则：ASCII 引号 → 右引号，反斜杠剔除
const s = RegistryDoc.sanitize('他说"你好" \\ 再见');
check("清洗规则: " + s, s === "他说”你好”  再见");

// 7) 数组字段（medium）：读与回写
check("读 medium 数组", RegistryDoc.getArrayField(dEntry.slice, "medium").includes("手绘插图"));
const dArr = RegistryDoc.setArrayField(dEntry.slice, "medium", "米色纸面 / 手绘插图 / 生长状态标注");
check("回写 medium 数组", dArr.includes('["米色纸面", "手绘插图", "生长状态标注"]'));
const arrText = RegistryDoc.applyEdits(text, [{ start: dEntry.start, end: dEntry.end, text: dArr }]);
try {
  const g = new Function(arrText + "; return EXHIBITS.find(x=>x.id==='digital-garden').medium.join('|');");
  check("数组改写后可执行且值正确", g() === "米色纸面|手绘插图|生长状态标注");
} catch (e) { check("数组改写后可执行: " + e.message, false); }

// 8) 新增收录：构造条目 → 插入数组尾部 → 全文仍合法且数据正确
const block = RegistryDoc.buildEntry({
  id: "example-site", zone: "collect", no: "007", cn: "柒",
  title: "示例站", year: "2026", origin: "收录", url: "https://example.com/",
  note: "测试条目。", embedFalse: true,
});
check("buildEntry 生成含 embed:false 的条目", block.includes('id: "example-site"') && block.includes("embed: false"));
const ins = RegistryDoc.insertIntoArray(text, doc, block);
check("插入点越过最后一项的尾逗号", ins.text.includes('"note: 不存在的字段",\n  "x"') === false);
try {
  const r = new Function(ins.text + "; return { n: EXHIBITS.length, last: EXHIBITS[EXHIBITS.length - 1] };")();
  check("插入后总数 7", r.n === 7);
  check("新条目字段正确", r.last.id === "example-site" && r.last.no === "007" && r.last.url === "https://example.com/" && r.last.embed === false);
  check("新条目位于既有条目之后", ins.text.indexOf("example-site") > ins.text.indexOf("harry-homepage"));
} catch (e) { check("插入后全文可执行: " + e.message, false); }

console.log(ok ? "── 全部通过 ──" : "── 存在失败 ──");
process.exit(ok ? 0 : 1);
