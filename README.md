# 繁花·纷落角色卡档案：AI 维护规范

这是本仓库的维护说明。任何 AI 在新增角色卡、替换图片、修改角色数据或重新部署之前，都必须先完整阅读本文件。

```text
index.html  网站本体，不要用另一套页面重写它。
README.md   本文件，规范来源。
```

## 0. 数据不在本仓库

本仓库只有 `index.html` 和 `README.md`。角色卡数据和图片全部在**另一个仓库**：

```text
仓库：hqu35785-cmyk/fanhuafenluo

作品列表：src/data/works.js
          数组名：latestFanhuaWorks / fanhuaWorks / sharkWorks / waWorks
角色详情：src/data/details-fanhua.js
          src/data/details-shark.js
          src/data/details-wa.js
原始 PNG：assets/tavo/new/
网页预览：assets/previews/tavo/new/
```

新增角色卡需要**同时改两个仓库**，缺一个都不完整。

本仓库的 `index.html` 使用 `<template id="archiveCardTemplate">` 按源数据数量生成卡片。新增卡片时不要复制 70 份 HTML，不要增加固定数量常量，也不要手动制造第二套卡片或弹窗结构；如果修改了页面模板、数据解析、图片加载或部署版本，才修改本仓库的 `index.html`。

## 1. 最重要的图片规则：眼睛和头部优先

角色卡原始 PNG 可以保留完整立绘，但网页预览必须优先显示人物的头部和眼睛。

每一张卡都必须满足：

- 预览框内能看到眼睛，或至少能看到完整的眼睛所在面部区域。
- 头顶、眉毛和眼睛不能被预览框上边缘裁掉。
- 不允许出现「只看到胸口、身体、手部或下半张脸，看不到眼睛」的预览。
- 脸部应位于预览区域上半部，眼睛线建议落在预览高度的 15%–35% 范围内。
- 可以保留肩膀和上半身，但头部优先级高于胸口、服装、手部和背景。
- 不要为了展示全身而把人物头部缩得过小。

当前页面默认展示焦点：

```text
previewPosition: "50% 8%"
```

- 第一个百分比是水平位置，`50%` 表示水平居中。
- 第二个百分比是垂直位置，数值越小越向上，越优先显示头部。
- 人脸偏低时用 `"50% 4%"`。
- 头顶已贴近上边缘时才允许 `"50% 12%"`。
- **禁止** `"50% 50%"`，那会恢复容易裁掉眼睛的居中裁切。

`previewPosition` 会同时作用于列表卡面、详情弹窗顶图和保存面板预览，三处一起验证。

## 2. preview 和 image 是两个不同的文件

**这一条最容易搞错，搞错会直接毁掉页面性能。**

```text
preview  必须是单独生成的小图
         格式 webp，长边约 640，单文件控制在 100 KB 以内
         示例：assets/previews/tavo/new/Tavo_角色名_XXXX.webp（约 37 KB）

image    完整原始 PNG，供「保存角色卡 PNG」下载
         示例：assets/tavo/new/Tavo_角色名_XXXX.png（1.2–1.7 MB）
```

**禁止把 `preview` 写成原始 PNG 的路径。** 首页要同时渲染最多几十张卡，preview 指向原图会让首页去下几十上百 MB 的 PNG。

原始 PNG 只出现在 `image` 字段和下载链路里，不参与列表渲染。

## 3. 新角色卡数据格式

### 3.1 `src/data/works.js`

```js
{
  name: "角色名称",
  image: "assets/tavo/new/Tavo_%E8%A7%92%E8%89%B2%E5%90%8D_1234.png",
  preview: "assets/previews/tavo/new/Tavo_%E8%A7%92%E8%89%B2%E5%90%8D_1234.webp",
  previewPosition: "50% 8%",
  _detailKey: "assets/tavo/new/Tavo_%E8%A7%92%E8%89%B2%E5%90%8D_1234.png",
  alias: "TAVO · 1234",
  collectionLabel: "TAVO ROLE CARD",
  cardLabel: "角色身份",
  role: "一句话角色定位",
  tags: ["标签一", "标签二"],
  creator: "繁花·纷落"
}
```

字段要求：

- `name`：角色名称。
- `image` / `preview`：相对路径，必须真实存在。**中文文件名在数据里是百分号编码的**，照抄现有条目的写法。
- `_detailKey`：必须和 `image` **逐字符完全一致**，页面靠它去 details 文件里取详情。
- `previewPosition`：两个百分比，空格分隔。
- `alias` / `collectionLabel` / `cardLabel` / `role` / `tags` / `creator`：有真实资料才填，不要编造。

没有 `previewPosition` 时页面自动用 `"50% 8%"`，不会回到居中裁切。

### 3.2 `src/data/details-{fanhua|shark|wa}.js`

必须同时补一条详情，key 就是 `_detailKey`：

```js
window.__LAZY_DETAILS__.fanhuafenluo["assets/tavo/new/Tavo_%E8%A7%92%E8%89%B2%E5%90%8D_1234.png"] = {
  opening: "开场白全文",
  personality: "性格简介全文",
  setting: "人物设定 / 剧情全文"
};
```

`opening`、`personality`、`setting` 三个字段缺任何一个，详情弹窗对应栏会显示缺省文案。缺少资料时不要编造内容。

`worldbook` / `lorebook` 字段目前全站为空；有真实内容时可以加，没有就不要加空字符串。

## 4. 改了数据必须同步换 `?v=` 版本号

页面不再使用 `cache:'no-cache'`，数据文件的失效完全靠 URL 上的版本参数。当前 `index.html` 中的形式是：

```js
const SOURCE_URLS={
  works:'src/data/works.js?v=49902ffceff5',
  details:{
    fanhuafenluo:'src/data/details-fanhua.js?v=da80d31cbb75',
    shark:'src/data/details-shark.js?v=v3lazy',
    wa:'src/data/details-wa.js?v=v3lazy'
  }
};
```

**每次修改源站 `src/data/*.js`，都必须把 `index.html` 里对应的 `?v=` 换成新值**（用新的 commit SHA 前 12 位即可）。不换 = 浏览器吃缓存 = 线上看不到任何变化。

## 5. 给 AI 的机械执行步骤

1. 先读完本 `README.md`。
2. 检查当前 `index.html`，不要根据聊天记录重写页面。
3. 在源站仓库 `hqu35785-cmyk/fanhuafenluo` 中准备完整 PNG：`assets/tavo/new/`。
4. 在同一源站准备单独的网页预览 WebP：`assets/previews/tavo/new/`；长边约 640，单文件不超过 100 KB。
5. 确认路径、文件名、大小写、百分号编码完全正确。
6. 在 `works.js` 对应数组（`latestFanhuaWorks` / `fanhuaWorks` / `sharkWorks` / `waWorks`）里加条目，字段按 §3.1。
7. 在对应的 `details-*.js` 里加同 key 的条目，字段按 §3.2。
8. 按 §4 更新本仓库 `index.html` 里对应的 `?v=`。
9. 打开卡片列表，确认第一眼能看到眼睛或头部，而不是只显示胸口、手部或下半张脸。
10. 打开详情弹窗，确认顶图能看到眼睛或头部，且简介、开场白、人物设定都有内容。
11. 打开保存面板，确认预览不只显示胸口；下载的仍是完整原始 PNG。
12. 确认失败时按源站 → jsDelivr → GitHub Raw 顺序回退，三源全失败时保持斜线态并显示 `CARD FACE UNAVAILABLE`。
13. 控制台无 404、无未处理 Promise rejection；页面无横向溢出。
14. 三位作者的数量、首张卡、末张卡和已有卡片都没被破坏。
15. 本地验证通过后再提交并等待 Pages 部署成功。

## 6. 禁止事项

- 禁止把 `preview` 写成原始 PNG 路径。
- 禁止把默认位置改回 `object-position: center` 或 `"50% 50%"`。
- 禁止只调整截图而不在数据里记录 `previewPosition`。
- 禁止用 Canvas 生成假的角色卡 PNG。
- 禁止删除「源站 → jsDelivr → GitHub Raw」三级图片备用来源。
- 禁止重新设计标题栏、卡片结构、详情弹窗、保存面板或任何原始动画。
- 禁止破坏 `content-visibility` / `.is-near` / `--card-ih` / 滚动物理这套渲染优化。
- 禁止把三源全失败时的 `CARD FACE UNAVAILABLE` 斜线兜底改成几何占位图形。
- 禁止加入敏感内容锁定 / 解锁机制。本站已明确决定不要这一套，数据里的 `sensitive*` 字段一律忽略。
- 禁止上传聊天附件、本地基准文件或 `original-index.html`。
- 禁止把规范写进临时聊天内容；本 README 才是唯一规范来源。

## 7. 最终验收标准

- 列表卡片能看到眼睛或头部。
- 详情弹窗顶图能看到眼睛或头部。
- 保存面板预览不只显示胸口。
- 详情三栏（简介 / 开场白 / 人物设定）都有真实内容。
- 无 `worldbook` / `lorebook` 数据时，第 4 个标签隐藏并且滑块宽度正确对齐 3 等分。
- `tags` 数组的真实内容会显示在详情标签中。
- 原始 PNG 下载有效，文件大小不为零。
- 源站失败时按 jsDelivr、GitHub Raw 顺序回退。
- 桌面、平板、手机宽度下无横向溢出。
- 新增卡片后站点不报 `SOURCE ERROR`，卡片数量自动跟随数据。
- 页面没有出现第二套卡片 CSS 或另一套 modal 结构。
- 页面有 `h1`、description、canonical、Open Graph、Twitter card、theme-color、favicon。
- 无障碍检查不出现 `aria-hidden` 包裹可用按钮；弹窗打开后 Tab 留在当前浮层内。
