# KcosGame · 开源小游戏平台

**科成-开放原子开源社团**（简称 Kcos）的开源小游戏平台。
全称：电子科技大学成都学院 科成-开放原子开源社团。

一个纯静态站点，把社团的三款开源主题小游戏收在同一个门户里，**打开即玩**：
没有外部依赖、没有 CDN、没有注册登录，也不需要在本地装 Node.js。

> **页面只做一件事：集成这三款游戏。**
> 首页只有四个部分——品牌顶栏、Hero（三路汇入同一入口的示意图）、三张游戏卡片、页脚。
> 不放设计规范、架构科普、协作流程之类与游戏无关的板块。

关于「冒险岛」那张卡片：这款游戏本体是浅底白卡，直接嵌进深色门户会与另外两张割裂。
门户侧给**所有**封面统一罩了一层 `--cover-veil`（`rgba(4,11,20,.58)`）深底，
把三张封面压到同一明度上，再靠色相区分——实测三张封面平均亮度极差从 28.1 降到 3.9。
**三款游戏本体没有任何改动**，这层罩只存在于门户的封面缩略图上。

## 收录作品

| 作品 | 形态 | 主题 / 玩法 | 入口 |
|---|---|---|---|
| **开源冒险岛 · 数据方舟** | 单文件网页游戏 | 拖拽拼合解谜：把开源许可证与 OpenTenBase 集群组件拖回正确的方舟槽位，11 关、3 颗心脏 | `game-maze/index.html` |
| **开源跑酷** | 单文件网页游戏 | 横版跑酷：沿开源之路收集八大开源项目徽章，跃过技术债、钻过兼容性门槛 | `game-parkour/index.html` |
| **OpenTenBase 数据调度中心** | React 19 + Vite（已编译） | 调度竞技：给三个 DN 分流、判断分片表还是复制表，14 波决策冲 Combo 与排行榜 | `game-tenbase/index.html` |

## 站点结构

```
KcosGame/
├── index.html              ← 门户首页（自包含单文件，零外部请求）
├── logo.png                ← 社团标志（256×256，门户与游戏共用）
├── game-maze/              ← 开源冒险岛 发布副本（逐字节复制上游，未改动）
│   └── index.html
├── game-parkour/           ← 开源跑酷 发布副本（逐字节复制上游，未改动）
│   └── index.html
├── game-tenbase/           ← 数据调度中心 发布副本（编译产物，自包含单文件）
│   ├── index.html
│   └── logo.png
├── tools/
│   └── build-tenbase.mjs   ← 发布构建脚本：把上游编译成 game-tenbase/
├── kaiyuanmaoxiandao/      ← 只读上游，本机保留，不上传
├── paoku/                  ← 只读上游，本机保留，不上传
└── TenDispatch/            ← 只读上游（独立仓库），本机保留，不上传
```

## 三款游戏的发布方式

- **开源冒险岛 / 开源跑酷**：上游本身就是零依赖的单文件 HTML，
  发布副本是**逐字节复制**（SHA256 与上游一致，仅文件名统一为 `index.html`）。
- **数据调度中心**：上游是 React + TypeScript 工程，必须编译。构建**只读**上游，
  全程在系统临时目录里完成，产物收成一个自包含的 `index.html`：

  ```powershell
  node tools/build-tenbase.mjs
  ```

  构建做了三件上游没做的事，都是为了"双击就能玩"：
  1. 输出改为 **IIFE 单包并内联**。Vite 默认产物是 `<script type="module">`，
     而 Chrome 在 `file://` 下会以 CORS 为由拒绝加载模块脚本——双击打开就是白屏。
  2. 字体转成 data URI 内联，并丢掉中文界面用不到的越南语 / 西里尔 / 希腊语子集。
  3. 社团头像缩到 256×256（上游原图 1254×1254 / 1.2MB，缩后约 64KB），
     落成独立文件而不是内联，整站由 2.4MB 降到 0.9MB。

  脚本是幂等的：连跑多次产物哈希一致。要跑上游自带的类型检查与测试，
  请直接在 `TenDispatch/` 目录里操作，本脚本不碰它。

## 视觉规范

> 这一节是**仓库内部的设计说明**，只存在于本文件。
> 门户页面上不再展示色板、字级等规范区块，规范本身照旧生效。

三款游戏原本各有一套配色与圆角：冒险岛是浅底大圆角，跑酷是深蓝胶囊，
调度中心是深蓝直角操作台。门户的做法是**取三者交集做底座，把差异压缩到一个色相**。

### 色板（全部取自三款游戏现存 token，未新造色相）

| 变量 | 色值 | 用途 |
|---|---|---|
| `--ink` | `#061019` | 页面底幕（跑酷深蓝与调度中心 `#07111F` 取中） |
| `--panel` | `#0B1728` | 卡面与面板（调度中心 `panel`） |
| `--panel-2` | `#10243A` | 次级面与按钮底（调度中心策略按钮底色） |
| `--line` | `#1E3A52` | 1px 发丝描边 |
| `--text` | `#DCEBF7` | 正文（对比度 15.8:1） |
| `--muted` | `#A9C2D6` | 说明文字（10.4:1） |
| `--dim` | `#7E97AC` | 元信息与路径（6.3:1） |
| `--cyan` | `#32C7F4` | **主色**：所有主按钮、焦点环、状态点（9.7:1） |
| `--gold` | `#FFD166` | 成就、榜单、高分 |
| `--orange` | `#FF9F43` | 负载预警，仅用于说明 |
| `--blue` | `#5A9BFF` | 冒险岛"科技蓝"降饱和版，只作环境光 |
| `--green` `--red` | `#19C37D` `#FF625C` | 语义专用（正常 / 临界），不做装饰 |

**统一规则**：主按钮在所有卡片里**一律 cyan**，不按游戏换色；
每张游戏卡只在"封面光晕 + 封面描边"两处露出自身色相。
三张卡片的 DOM 骨架逐字相同，只差一个 `data-accent`（`blue` / `cyan` / `gold`）。

### 字级

沿用三款游戏已有的系统字体栈，**不加载任何外部字体**：

- 中文：`"Noto Sans SC", "Source Han Sans SC", "Microsoft YaHei", "HarmonyOS Sans SC", "PingFang SC", system-ui, sans-serif`
- 等宽：`ui-monospace, "SFMono-Regular", "Cascadia Mono", Menlo, Consolas, "Courier New", monospace`
- 数字统一 `font-variant-numeric: tabular-nums`；英文标签大写 + `letter-spacing: .16em`

### 间距与圆角

间距取 8 的倍数；圆角向调度中心的直角操作台靠拢：
容器 `14px`、卡片内 `10px`、按钮 `6px`（取代上游原有的 `18px` 与 `999px` 大圆角）。
层级只用 1px 描边与底色差表达，不用重投影。
动效 180–420ms、`ease-out`；系统开启"减少动态效果"时全部关闭。

## 部署到 GitHub Pages

1. 提交站点内容：

   ```powershell
   node tools/build-tenbase.mjs        # 需要改动上游时先重新构建
   git add index.html logo.png README.md .gitignore tools game-maze game-parkour game-tenbase
   git commit -m "feat: publish self-hosted game portal"
   git push
   ```

2. 仓库 **Settings → Pages → Source** 选 `Deploy from a branch`，
   Branch 选 `main`、Folder 选 `/(root)`，保存。
3. 访问 `https://cduestc-openatom-open-source-club.github.io/KcosGame/`。

站点全部使用相对路径（`./game-*/index.html`），因此放在仓库子路径下也能正常工作。

## 仓库约定

- **只引用与派生，不改上游**：`kaiyuanmaoxiandao/`、`paoku/`、`TenDispatch/`
  是只读上游，本仓库不修改、不跟踪其内容；对外提供的是 `game-*` 下的派生副本。
  上游更新后重跑上文的复制 / 构建步骤即可刷新副本。
- 上传内容仅限：`README.md`、`index.html`、`logo.png`、`game-*/`、`tools/`、`.gitignore`。
- **除 `README.md` 以外的任何文档都不上传**，规则写在 `.gitignore` 中。
- 门户页**不引用任何站外资源**：没有外链字体、外链脚本、外链图片，整站自包含。
  页脚有两个指向站外的导航链接（社团官网 https://www.kcos.net.cn 与社团 GitHub
  https://github.com/CDUESTC-OpenAtom-Open-Source-Club ），它们是页面唯一的站外入口。
  （三款游戏内部的既有文案不受影响。）

## 参与开源

- [开放原子开源基金会](https://www.openatom.org/)
- [OpenTenBase 项目](https://github.com/OpenTenBase/OpenTenBase)
- [OpenTenBase 快速入门：CN、DN、GTM 架构](https://www.opentenbase.org/blog/01-quickstart/)
- [OpenTenBase 基本使用：分片表与复制表](https://docs.opentenbase.org/guide/03-basic-use/)

制作方：科成-开放原子开源社团（电子科技大学成都学院）。
