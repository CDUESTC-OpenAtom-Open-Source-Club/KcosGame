# KcosGame · 开放原子开源社团游戏集合

电子科技大学成都学院**开放原子开源社团**的小游戏集合门户。

一个纯静态的导航入口页（`index.html`），把社团做过的几款小游戏集中到一处：打开一次就能挑一个开玩。

## 收录作品

| 作品 | 形态 | 主题 / 玩法 | 入口 |
|---|---|---|---|
| **开源冒险岛 · 数据方舟** | 单文件网页游戏（v3.3） | 以 OpenTenBase 数据方舟为舞台的冒险玩法，整包就是一个 `index.html` | `kaiyuanmaoxiandao/index.html` |
| **开源跑酷** | 单文件网页游戏 | 开放原子开源基金会主题的跑酷小游戏，零依赖、零构建 | `paoku/index(4).html` |
| **TenDispatch · OpenTenBase 数据调度中心** | React 19 + TypeScript + Vite | 90 秒、14 波的数据调度竞技：DN 负载、分片/复制表判断、Combo 计分与排行榜 | [Lycorius03/TenDispatch](https://github.com/Lycorius03/TenDispatch) |

## 使用方式

本仓库是**导航门户**，不包含上面三款游戏的源码。要把入口页跑起来，只需让三个游戏目录与 `index.html` 处于同一层级，然后直接用浏览器打开 `index.html`：

```
KcosGame/
├── index.html            ← 入口页（本仓库）
├── README.md             ← 说明（本仓库）
├── kaiyuanmaoxiandao/    ← 游戏源码，本机保留，不随本仓库分发
├── paoku/                ← 游戏源码，本机保留，不随本仓库分发
└── TenDispatch/          ← 游戏源码，独立仓库维护
```

没有构建步骤、没有依赖：`index.html` 是自包含的单文件页面，双击即可打开。
TenDispatch 是完整工程，需要 Node.js 20.19+ 或 22.12+，在其自身目录内 `npm install && npm run dev`。

## 仓库约定

- 本仓库**只做引用与导航**，三款游戏的源码由各自的目录 / 仓库独立维护，本仓库不改动、不复制其内容。
- 上传内容仅限：`README.md`（本文档）与 `index.html`（入口页）。
- **除 `README.md` 以外的任何文档都不上传**，相关规则写在 `.gitignore` 中。

## 参与开源

- [开放原子开源基金会](https://www.openatom.org/)
- [OpenTenBase 项目](https://github.com/OpenTenBase/OpenTenBase)
- [OpenTenBase 官方快速入门：CN、DN、GTM 架构](https://www.opentenbase.org/blog/01-quickstart/)
- [OpenTenBase 官方基本使用：分片表与复制表](https://docs.opentenbase.org/guide/03-basic-use/)

制作方：电子科技大学成都学院开放原子开源社团。
