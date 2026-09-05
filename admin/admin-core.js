/* ============================================================
 * 策展后台 · registry.js 解析与回写核心
 * ------------------------------------------------------------
 * 设计目标：对 registry.js 做"外科手术式"字段替换——
 * 只改动被编辑的字段，未触碰的字节保持原样（含注释、空行、顺序）。
 * 浏览器与 Node 皆可使用（底部 UMD 导出）。
 *
 * 用法：
 *   const doc = RegistryDoc.parse(text);        // 定位 EXHIBITS 数组内每个展品块
 *   doc.entries -> [{ start, end, id, slice }]  // 绝对偏移，slice 为原文切片
 *   RegistryDoc.entryId(slice)  -> "harry-homepage"
 *   RegistryDoc.getField(slice, "note") -> 字符串
 *   RegistryDoc.setField(slice, "note", 新值) -> 新切片（非法字符自动清洗）
 *   RegistryDoc.applyEdits(text, [{start, end, text: 新切片}], ...) -> 新全文
 * ============================================================ */
(function (global) {
  "use strict";

  /* 扫描字符串/转义状态，找到与 arrStart 配对的 ']' */
  function findArrayEnd(text, arrStart) {
    let depth = 0, inStr = null, esc = false;
    for (let i = arrStart; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === inStr) inStr = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
      if (c === "[" || c === "{") depth++;
      else if (c === "]" || c === "}") {
        depth--;
        if (depth === 0) return i;
      }
    }
    throw new Error("registry.js 结构异常：找不到 EXHIBITS 数组结尾");
  }

  /* 切出 EXHIBITS 数组里每个顶层 {…} 的绝对偏移与切片 */
  function parse(text) {
    const marker = text.indexOf("const EXHIBITS");
    if (marker < 0) throw new Error("registry.js 里找不到 const EXHIBITS");
    const arrStart = text.indexOf("[", marker);
    const arrEnd = findArrayEnd(text, arrStart);

    const bodyStart = arrStart + 1;
    const entries = [];
    let depth = 0, inStr = null, esc = false, objStart = -1;
    for (let i = bodyStart; i < arrEnd; i++) {
      const c = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === inStr) inStr = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
      if (c === "{") { if (depth === 0) objStart = i; depth++; continue; }
      if (c === "}") {
        depth--;
        if (depth === 0) entries.push({ start: objStart, end: i + 1, slice: text.slice(objStart, i + 1) });
        continue;
      }
    }
    return { text, arrStart, arrEnd, entries };
  }

  function entryId(slice) {
    const m = slice.match(/\bid:\s*"([^"]+)"/);
    return m ? m[1] : null;
  }

  /* 读字段：仅支持 "…" 形式的字符串字段（本文件的展品字段均如此） */
  function getField(slice, field) {
    const m = slice.match(new RegExp('\\b' + field + ':\\s*"([^"]*)"'));
    return m ? m[1] : null;
  }

  /* 写字段：值里不允许反斜杠与 ASCII 引号（" 自动转成右引号 ”），换行折叠为空格 */
  function sanitize(value) {
    return String(value)
      .replace(/\\/g, "")
      .replace(/"/g, "”")
      .replace(/\r?\n/g, " ")
      .trim();
  }

  function setField(slice, field, value) {
    const v = sanitize(value);
    const re = new RegExp('(\\b' + field + ':\\s*")[^"]*(")');
    if (!re.test(slice)) throw new Error("字段不存在或不是字符串字段: " + field);
    return slice.replace(re, "$1" + v + "$2");
  }

  /* 数组字段（如 medium: ["a", "b"]）：读为 "a / b"，写时按 / 拆分 */
  function getArrayField(slice, field) {
    const m = slice.match(new RegExp("\\b" + field + ":\\s*\\[([\\s\\S]*?)\\]"));
    if (!m) return null;
    return (m[1].match(/"([^"]*)"/g) || []).map((s) => s.slice(1, -1)).join(" / ");
  }

  function setArrayField(slice, field, value) {
    const parts = String(value).split("/").map((s) => sanitize(s)).filter(Boolean);
    const re = new RegExp("(\\b" + field + ":\\s*\\[)[\\s\\S]*?(\\])");
    if (!re.test(slice)) throw new Error("字段不存在或不是数组字段: " + field);
    return slice.replace(re, "$1" + parts.map((p) => '"' + p + '"').join(", ") + "$2");
  }

  /* 新增收录：按既有字段顺序构造一个条目文本块（JSON.stringify 保证字符串安全） */
  function buildEntry(v) {
    const lines = ["  {"];
    lines.push('    id: ' + JSON.stringify(v.id) + ',');
    if (v.zone) lines.push('    zone: ' + JSON.stringify(v.zone) + ',');
    lines.push('    no: ' + JSON.stringify(v.no) + ',');
    if (v.cn) lines.push('    cn: ' + JSON.stringify(v.cn) + ',');
    lines.push('    title: ' + JSON.stringify(v.title) + ',');
    if (v.titleEn) lines.push('    titleEn: ' + JSON.stringify(v.titleEn) + ',');
    lines.push('    year: ' + JSON.stringify(v.year || "") + ',');
    lines.push('    origin: ' + JSON.stringify(v.origin || "收录") + ',');
    lines.push('    medium: [],');
    lines.push('    aspect: 16 / 10,');
    lines.push('    url: ' + JSON.stringify(v.url) + ',');
    lines.push('    path: null,');
    if (v.embedFalse) lines.push('    embed: false,');
    lines.push('    live: ' + JSON.stringify(v.live || v.url) + ',');
    lines.push('    note: ' + JSON.stringify(v.note || "策展人注——待补充。") + ',');
    lines.push('  }');
    return lines.join("\n");
  }

  /* 把条目文本块插入 EXHIBITS 数组尾部（越过最后一项的尾逗号），
   * 返回 { at, text }：at 是插入点在原文中的偏移，text 为插入后全文 */
  function insertIntoArray(text, doc, block) {
    if (!doc.entries.length) {
      const at = doc.arrStart + 1;
      return { at, text: text.slice(0, at) + "\n  " + block + "\n" + text.slice(at) };
    }
    const last = doc.entries[doc.entries.length - 1];
    let at = last.end;
    if (text[at] === ",") at += 1;
    return { at, text: text.slice(0, at) + "\n  " + block + text.slice(at) };
  }

  /* 把若干 {start, end, text} 替换块从后往前拼回全文（偏移互不重叠） */
  function applyEdits(text, edits) {
    const sorted = edits.slice().sort((a, b) => b.start - a.start);
    let out = text;
    for (const e of sorted) out = out.slice(0, e.start) + e.text + out.slice(e.end);
    return out;
  }

  const api = { parse, entryId, getField, setField, getArrayField, setArrayField, buildEntry, insertIntoArray, applyEdits, sanitize };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.RegistryDoc = api;
})(typeof window !== "undefined" ? window : globalThis);
