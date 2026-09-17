# -*- coding: utf-8 -*-
"""代理中断期的应急推送：Git Data API 四步推送多个文件（单提交）。
用法：python tests/api_push_panorama.py <token>
"""
import base64, io, json, sys, urllib.request

TOKEN = sys.argv[1]
REPO = "Alidadei/ui-museum"
BRANCH = "main"
MSG = ("feat: 007 桌面全景——两侧黑幕换成从原图自身像素延展的星域：镜像条横向涂抹成余晖"
       "（防对称穿帮）、提取孤立星播种两翼逐颗呼吸、边缘暗部取底色；手机竖屏自动退化纯竖图；"
       "附同构 Python 像素预览器供接缝审核")
FILES = [
    "registry.js",
    "tests/cosmos.stub.test.js",
    "tests/wing-preview.py",
    "uis/cosmic-river/cosmos.js",
    "uis/cosmic-river/index.html",
    "uis/cosmic-river/style.css",
]
TAG = "museum-v1.12-panorama"


def api(method, path, body=None):
    req = urllib.request.Request(
        "https://api.github.com" + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Authorization": "Bearer " + TOKEN,
            "Content-Type": "application/json",
            "User-Agent": "ui-museum-push",
            "Accept": "application/vnd.github+json",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


head = api("GET", f"/repos/{REPO}/git/ref/heads/{BRANCH}")["object"]["sha"]
head_commit = api("GET", f"/repos/{REPO}/git/commits/{head}")
base_tree = head_commit["tree"]["sha"]
print("head:", head[:10], "tree:", base_tree[:10])

tree = []
for path in FILES:
    data = io.open(path, "rb").read()
    blob = api("POST", f"/repos/{REPO}/git/blobs",
               {"content": base64.b64encode(data).decode(), "encoding": "base64"})
    tree.append({"path": path, "mode": "100644", "type": "blob", "sha": blob["sha"]})
    print("blob", path, blob["sha"][:10], len(data), "B")

new_tree = api("POST", f"/repos/{REPO}/git/trees", {"base_tree": base_tree, "tree": tree})
commit = api("POST", f"/repos/{REPO}/git/commits",
             {"message": MSG, "tree": new_tree["sha"], "parents": [head]})
print("commit:", commit["sha"][:10])

api("PATCH", f"/repos/{REPO}/git/refs/heads/{BRANCH}", {"sha": commit["sha"], "force": False})
print("main ->", commit["sha"][:10])

# 顺手把 v1.12 tag 也建到这个提交上（远端此前没有这个 tag）
try:
    tag = api("POST", f"/repos/{REPO}/git/tags",
              {"tag": TAG, "message": MSG, "object": commit["sha"], "type": "commit"})
    api("POST", f"/repos/{REPO}/git/refs", {"ref": "refs/tags/" + TAG, "sha": tag["sha"]})
    print("tag", TAG, "->", commit["sha"][:10])
except Exception as e:
    print("tag step:", e)
