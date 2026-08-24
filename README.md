# 繁花·纷落｜TAVO 角色卡档案

三位创作者、98 张角色卡、完整的角色资料与原始 PNG。你可以在自适应的档案页面里浏览每张卡的 AI 导览简介、开场白、人物设定、世界书和预设，也可以保存角色卡原始 PNG。

## 在线浏览

默认推荐使用无卡片滚动惯性的版本：

[打开无惯性版](https://hqu35785-cmyk.github.io/fanhuafenluo/)

如果想查看当前旧版的卡片滚动惯性效果：

[打开有惯性版](https://hqu35785-cmyk.github.io/fanhuafenluo/index-inertia.html)

`98 张卡`　`繁花·纷落 70 / 鲨鱼 14 / 咓 14`　`响应式浏览`　`原始 PNG`　`五栏真实资料`

## 两个页面版本

展示仓库保留三个主要条目；`assets/` 目录中的两个文件是默认页面必需的动效支持资源，不是第三个页面：

```text
index.html          默认无惯性版
index-inertia.html  当前有惯性版的完整保留副本
README.md           访客说明与 AI 维护契约
```

默认无惯性版使用以下固定资源，路径和文件名不能改动：

```text
assets/css/motion.css
assets/js/motion.js
```

两个 HTML 页面必须拥有相同的角色数据、卡片、作者切换、详情资料、预览图片、原始 PNG 下载、响应式布局和主要视觉结构。当前默认页额外接入 `assets/css/motion.css` 与 `assets/js/motion.js` 作为新的入场、弹窗、标签和保存面板动效；`index-inertia.html` 保持原有的完整有惯性版本，不得在没有明确要求时覆盖或同步改写它。两个版本的滚动行为差异是：

- `index.html`：页面滚动时卡片不产生位移、倾斜、拉伸、图片反向位移、压力高光或弹簧回弹；正常浏览器滚动保持不变。
- `index-inertia.html`：保留当前卡片随页面滚动产生的位移、倾斜、轻微拉伸、压力高光和回弹效果。

无惯性版是 GitHub Pages 根地址的默认入口；有惯性版通过 `index-inertia.html` 独立访问。`index.html` 必须与上述两个动效资源一起部署；`index-inertia.html` 继续保持单文件独立运行。

## 你可以看到什么

- 由 AI 阅读每张卡全部原始资料后写成的 120–180 字简介：既概括角色，也保留真实存在的冲突、关系和互动悬念。
- PNG 内嵌的真实开场白，不用人工占位文本代替。
- PNG 内嵌的性格与场景设定，按原文分段显示。
- 完整世界书：包含原始名称、条目顺序、启用状态、位置、关键词和内容。
- 完整预设：按原文显示系统提示词和历史后指令。
- 原始角色卡 PNG 下载；网页预览使用单独的轻量 WebP，不用原始 PNG 拖慢首页。
- 桌面、平板和手机自适应布局；手机端详情标签可以横向滚动。

## 仓库边界

这个展示仓库公开的主要页面与说明文件只能有以下三个：

```text
index.html
index-inertia.html
README.md
```

除上述三个主要条目外，只允许存在默认 `index.html` 必需的两个动效支持文件：

```text
assets/css/motion.css
assets/js/motion.js
```

角色卡源仓库是 [hqu35785-cmyk/fanhuafenluo-pages](https://github.com/hqu35785-cmyk/fanhuafenluo-pages)：

```text
src/data/works.js
src/data/card-intros.json
src/data/details-fanhua.js
src/data/details-shark.js
src/data/details-wa.js
scripts/sync-card-details.mjs
assets/**/*.png
assets/**/*.webp
```

不要把 `work/original-index.html`、聊天附件、临时 JSON、截图、未列出的脚本/样式或本地测试文件上传到展示仓库。

## 给未来 AI 的唯一维护契约

任何 AI 在新增角色卡、修改角色卡、修改详情映射、修改共同视觉或重新部署前，必须先完整阅读本 README，再检查仓库中实际存在的三个主要条目和两个动效支持文件。禁止根据聊天记录重写页面，禁止把当前页面改成另一套卡片、标题栏、弹窗或保存面板。

修改展示页时必须同时检查 `index.html` 和 `index-inertia.html`：

1. 角色数据、缓存版本、图片备用链、五栏详情、下载逻辑和共同 CSS 修改必须同步到两个 HTML。
2. 只有滚动物理相关代码可以有版本差异。
3. 不得把滚动物理重新加回默认 `index.html`。
4. 不得从 `index-inertia.html` 删除滚动物理，除非用户明确要求同时取消有惯性版本。
5. 不得只改其中一个页面后直接提交。
6. 不得增加第四个主要页面/说明文件、未登记的共享脚本、未登记的样式文件或临时数据文件；`assets/css/motion.css` 与 `assets/js/motion.js` 是当前唯一登记的展示动效支持资源。

### 新增角色卡时必须改源仓库

在源仓库完成以下内容：

1. 把完整原始 PNG 放入正确的 `assets/` 路径。
2. 生成单独的 WebP 预览图，放入 `assets/previews/`；预览图只用于页面展示，不能把 `preview` 指向 PNG。
3. 在 `src/data/works.js` 的正确数组中添加作品记录。
4. `image` 和 `_detailKey` 必须逐字符一致；中文路径沿用现有百分号编码写法。
5. `preview` 必须是真实存在的 WebP，`image` 必须是真实存在的 PNG。
6. 真实日期才写入 `createdAt`，没有可靠日期时留空或省略，不得用当前日期、作者或 alias 猜测。
7. 预览焦点必须优先放在眼睛和头部附近。默认值为 `50% 8%`；除非实际卡面需要，不得改回 `50% 50%`。

### AI 简介不是 description 原文

详情里的“简介”不是 PNG 的 `description` 原文，也不是 `role + personality` 的拼接。

AI 必须先阅读该卡的全部原始字段：

```text
description
first_mes
personality
scenario
character_book
system_prompt
post_history_instructions
name / role / tags / creator / cardLabel
```

然后写一段 120–180 个可见字符的中文导览简介。简介必须同时做到：

- 让访客知道角色是谁、与用户是什么关系、故事从什么前提开始。
- 提炼最鲜明的性格、世界设定、关系矛盾或互动方式。
- 在结尾留下真实存在的选择、冲突或悬念，让人愿意继续打开资料。
- 只写源资料能够证明的内容，不补写不存在的人物、能力、关系和结局。
- 不能把系统指令、字数限制或格式规则原样当成宣传文案。
- 不能批量只替换角色名，98 条简介必须分别根据对应 `_detailKey` 的全部资料审核。

简介仍然只有一个 `intro` 字段，不增加 `hook`、`teaser` 或第六个标签。成人主题可以在明确成年角色的简介中直接说明，但简介应保持档案导览形式；明确未满 18 岁或年龄无法确认的角色，只能非露骨地概括人物、关系、冲突和世界背景。

### 简介定稿文件与源哈希

AI 简介定稿写入源仓库：

```text
src/data/card-intros.json
```

每个 key 必须是完整 `_detailKey`：

```json
{
  "assets/tavo/new/Tavo_%E8%A7%92%E8%89%B2_1234.png": {
    "intro": "这里是根据该卡全部原始资料写成的 120–180 字简介。",
    "sourceHash": "小写 64 位 SHA256"
  }
}
```

`sourceHash` 对 PNG 元数据中的以下字段按工具规定的稳定顺序计算：

```text
description
first_mes
personality
scenario
character_book
system_prompt
post_history_instructions
```

PNG 内容变化后必须重新阅读全部资料并重写简介，不能继续使用旧简介。

### 使用同步工具

在源仓库根目录运行：

```bash
node scripts/sync-card-details.mjs --intro-brief --all
```

该命令输出供 AI 阅读的完整资料包、作品元数据和 sourceHash；输出只用于本地写简介，不要把资料包作为临时文件提交。

写入 `src/data/card-intros.json` 后运行：

```bash
node scripts/sync-card-details.mjs --write
node scripts/sync-card-details.mjs --check
```

`--write` 会从 PNG 重新提取真实的 `first_mes`、`personality`、`scenario`、`character_book`、`system_prompt` 和 `post_history_instructions`，再合并 AI 简介，生成：

```text
src/data/details-fanhua.js
src/data/details-shark.js
src/data/details-wa.js
```

`--check` 必须通过以下检查才允许提交：

```text
70 / 14 / 14 / 98 数量正确
AI 简介数量 = 98
简介长度全部为 120–180
简介不是 description 原文
简介没有重复、占位文案或失联 key
sourceHash 全部最新
开场白逐字段等于 first_mes
人物设定逐字段等于 personality / scenario
世界书包含所有原始条目，含停用条目
预设等于两个原始提示字段的确定性分段
PNG 签名、chunk 边界和 chara 元数据全部有效
```

同样的 PNG 输入必须得到逐字节相同的详情文件。连续运行两次 `--write`，第二次 Git diff 必须为空。

### 展示页的五栏契约

展示页的两个版本都必须保留以下顺序：

```text
01 简介
02 开场白
03 人物设定
04 世界书
05 预设
```

字段映射固定为：

```text
简介     work.intro
开场白   work.opening
人物设定 work.personality + work.setting
世界书   work.worldbook
预设     work.preset
```

没有世界书或预设时，标签不能隐藏，阅读区显示固定缺省文案：

```text
该角色卡暂未提供简介。
该角色卡未提供开场白。
该角色卡未提供人物设定。
该角色卡未附带世界书。
该角色卡未附带预设。
```

角色资料必须使用 `textContent` 写入，不能用 `innerHTML` 执行卡片原文中的标签或脚本。

### 滚动惯性版本的维护边界

无惯性版只允许删除以下卡片滚动物理行为：

```text
卡片滚动位移
卡片 rotateX / rotateZ 倾斜
卡片滚动拉伸与压缩
图片、幽灵边框和条纹层的反向位移
滚动方向压力高光
滚动停止后的弹簧回弹
```

以下功能不属于滚动惯性，两个版本都必须保留：

```text
浏览器正常页面滚动
手机触摸滚动
作者筛选栏和详情标签横向滚动
详情阅读区内部滚动
卡片加载动效
作者切换动效
详情弹窗动效
详情标签切换动效
保存面板动效
prefers-reduced-motion 支持
```

无惯性版不得通过 `wheel`、`touchmove` 或 `pointermove` 阻止正常浏览器滚动，也不得新增全局 `overflow:hidden`、`touch-action:none` 或 `overscroll-behavior:none` 来伪造“无惯性”。

## 发布前检查

源仓库发布后，先记录源仓库合并后的完整 SHA，再把两个展示页四个 `SOURCE_URLS` 的 `?v=` 更新为该 SHA 前 12 位：

```text
works.js
details-fanhua.js
details-shark.js
details-wa.js
```

展示仓库提交前必须检查：

- 主要条目恰好为 `index.html`、`index-inertia.html`、`README.md`，并且只有 `assets/css/motion.css`、`assets/js/motion.js` 两个登记的动效支持文件。
- `index-inertia.html` 与实施前的正式有惯性版本逐字节一致。
- 两个页面的卡片数量均为 70 / 14 / 14，总计 98。
- 眼睛和头部在列表卡面、详情顶图、保存面板中都没有被裁掉。
- 预览链保持源站 WebP → jsDelivr → GitHub Raw。
- 下载链保持源站 PNG → jsDelivr → GitHub Raw。
- 五个标签在桌面端等宽，在手机端可横向滚动。
- 第五个“预设”能够完整滚入并点击。
- 详情内容只在阅读区滚动，页面没有横向溢出。
- 两个页面的作者切换、详情弹窗、原始 PNG 下载和保存面板一致。
- 无惯性版滚动时没有卡片物理变形；有惯性版仍保留原行为。
- `Escape`、焦点恢复、`prefers-reduced-motion` 都正常。
- 控制台没有 404、错误、警告或未处理 Promise rejection。
- 两个页面的 `@keyframes` 数量仍为 68；无惯性版的 transition 数量只允许因删除专用滚动物理 CSS 而变化。

## 禁止事项

- 不要把 PNG 当作首页 preview。
- 不要把预览焦点改回 `50% 50%`。
- 不要使用 Canvas 生成假的角色卡 PNG。
- 不要删除源站、jsDelivr、GitHub Raw 三级备用链。
- 不要把简介回退到 `role + personality`。
- 不要把 `work.lorebook` 当作世界书别名。
- 不要把“资料整理中”作为正式数据提交。
- 不要删除第五个预设标签。
- 不要把无惯性版的修改复制回有惯性版，或把有惯性代码重新加回默认版。
- 不要把 `index-inertia.html` 重命名、删除或覆盖成其他版本。
- 不要上传 `original-index.html`、聊天附件、临时资料包或测试截图。
- 展示仓库不得增加第四个主要页面/说明文件或任何未登记的公开文件。
