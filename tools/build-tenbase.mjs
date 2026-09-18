#!/usr/bin/env node
/**
 * TenDispatch 发布构建
 * ---------------------------------------------------------------------------
 * 把只读上游 `TenDispatch/` 编译成 `game-tenbase/` 下**一个自包含的 index.html**。
 *
 * 为什么走这条路：
 *   1. 上游目录只读 —— 全部构建都在系统临时目录里做，`TenDispatch/` 不会多出
 *      `node_modules/`、`dist/` 或任何被改过的文件。
 *   2. Vite 默认产物是 `<script type="module">`，Chrome 在 file:// 下会以 CORS
 *      为由拒绝加载模块脚本 —— 双击打开就是白屏。这里改成 IIFE 单包输出，
 *      再内联成经典 `<script>`，file:// 与 GitHub Pages 两种打开方式都能跑。
 *   3. 收成单文件后没有 `assets/` 相对路径问题，也就不必为 Pages 子路径配 base。
 *
 * 产物：game-tenbase/index.html（自包含：内联 CSS、JS、字体与社团头像）
 *
 * 用法：node tools/build-tenbase.mjs
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = path.join(ROOT, 'TenDispatch')
const OUT_DIR = path.join(ROOT, 'game-tenbase')
const OUT_HTML = path.join(OUT_DIR, 'index.html')
const WORK_DIR = path.join(os.tmpdir(), 'kcos-tenbase-build')

const MIN_NODE = [20, 19]
const [major, minor] = process.versions.node.split('.').map(Number)
if (major < MIN_NODE[0] || (major === MIN_NODE[0] && minor < MIN_NODE[1])) {
  die(`需要 Node.js ${MIN_NODE.join('.')}+ 才能构建 TenDispatch，当前为 ${process.versions.node}`)
}

function die(message) {
  console.error(`\n[build-tenbase] 构建中止：${message}\n`)
  process.exit(1)
}

function log(message) {
  console.log(`[build-tenbase] ${message}`)
}

/**
 * 找到 npm 的可执行入口。
 * Windows 上直接 spawn `npm.cmd` 会踩 EINVAL（.cmd 需要 cmd.exe 包装），
 * 所以优先让 Node 直接跑 npm 自带的 CLI 脚本，最稳。
 */
function resolveNpm() {
  if (process.platform !== 'win32') return { command: 'npm', prefixArgs: [] }

  const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  if (fs.existsSync(npmCli)) return { command: process.execPath, prefixArgs: [npmCli] }

  // 兜底：非标准布局时交给 shell 解析
  return { command: 'npm.cmd', prefixArgs: [], shell: true }
}

/** 在临时构建目录里跑一条 npm 命令 */
function runNpm(npm, args) {
  execFileSync(npm.command, [...npm.prefixArgs, ...args], {
    cwd: WORK_DIR,
    stdio: ['ignore', 'inherit', 'inherit'],
    ...(npm.shell ? { shell: true } : {}),
  })
}

/**
 * 把社团头像缩到 256×256。
 * 上游原图是 1254×1254 / 1.2MB，而它在游戏里最大只显示 40px、在门户上 44px，
 * 缩图后约 64KB —— 省下 1.1MB，视觉上看不出差别（走的还是高保真重采样）。
 * 只改临时副本，上游图片一个字节都不动。
 */
function optimizeLogo() {
  const imageDir = path.join(WORK_DIR, 'image')
  if (!fs.existsSync(imageDir)) return null

  const png = fs.readdirSync(imageDir).find((name) => name.toLowerCase().endsWith('.png'))
  if (!png) return null

  const source = path.join(imageDir, png)
  // 放在 src/ 里而不是 public/：src 下的相对导入会被 Vite 当成资源处理，
  // 能拿到带 hash 的产物路径，public/ 反而只做原样复制。
  const target = path.join(WORK_DIR, 'src', 'logo.png')
  fs.mkdirSync(path.dirname(target), { recursive: true })

  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile(${psQuote(source)})
$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($src, 0, 0, $size, $size)
$g.Dispose()
$bmp.Save(${psQuote(target)}, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$src.Dispose()
`

  try {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      stdio: ['ignore', 'inherit', 'inherit'],
    })
  } catch {
    return null
  }

  fs.rmSync(source, { force: true })
  // 头像已经搬到 src/logo.png，src 里的引用也改过去了，
  // 把整个 image/ 目录清掉，免得 Vite 又把 1.2MB 原图当成资源再发布一份。
  fs.rmSync(imageDir, { recursive: true, force: true })
  return fs.existsSync(target) ? { relative: 'src/logo.png', bytes: fs.statSync(target).size } : null
}

/** PowerShell 单引号字符串转义（内部单引号翻倍） */
function psQuote(value) {
  return `'${value.replace(/'/g, "''")}'`
}

/**
 * 直接调用 Vite 的 CLI 打包，不走 `npm run build`。
 * 原因：上游的 build 脚本是 `tsc -b && vite build`，而 tsc 会连带类型检查
 * vite.config.ts，本补丁用到的 node:fs / Buffer 需要 @types/node —— 上游没装它。
 * 这里只做打包（esbuild 负责转译 TS，不做类型检查），
 * 想跑上游的类型检查与测试，请直接在上游目录里操作。
 */
function runViteBuild() {
  const viteBin = path.join(WORK_DIR, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!fs.existsSync(viteBin)) die(`找不到 Vite 可执行文件：${viteBin}`)
  try {
    execFileSync(process.execPath, [viteBin, 'build'], {
      cwd: WORK_DIR,
      stdio: ['ignore', 'inherit', 'inherit'],
    })
  } catch (error) {
    const detail = error && typeof error === 'object' && 'status' in error ? `（退出码 ${error.status}）` : ''
    die(`vite build 失败${detail}：${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Vite 配置。产出单包 IIFE，并在 generateBundle 里把整包收成一个自包含 HTML。
 * 注意：这份配置是被 Vite（ESM）直接加载的，所以可以照常用 import。
 */
function viteConfig() {
  const outHtml = JSON.stringify(OUT_HTML)
  const outDir = JSON.stringify(OUT_DIR)

  return `import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT_HTML = ${outHtml}
const OUT_DIR = ${outDir}

const MIME = {
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

function mimeOf(fileName) {
  const dot = fileName.lastIndexOf('.')
  return MIME[dot < 0 ? '' : fileName.slice(dot).toLowerCase()] ?? 'application/octet-stream'
}

/**
 * 把构建产物收成单文件 + 一个图片资源：
 *   - 取出 Vite 的 HTML 模板、CSS、入口 JS
 *   - 丢掉中文界面用不到的越南语 / 西里尔 / 希腊语字体子集
 *   - 字体转 data: URI（避免 file:// 下被当成跨源请求），脚本内联为经典 <script>
 *   - 位图保留为独立文件（图片没有 CORS 限制，社团头像 64KB 走文件比内联省 1.5MB）
 *   - 移除 HTML / JS / CSS 这些中间产物，最终只落盘 index.html（+ assets/ 里的图片）
 */
function selfContainedBundle(): Plugin {
  return {
    name: 'kcos-self-contained-bundle',
    enforce: 'post',
    generateBundle(_options: unknown, bundle: Record<string, any>) {
      let html = ''
      let entry = null
      const css = []
      const fonts = []

      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type === 'chunk') {
          if (output.isEntry) entry = output
        } else if (fileName.endsWith('.html')) {
          html = String(output.source)
        } else if (fileName.endsWith('.css')) {
          css.push(String(output.source))
        } else if (/\\.(woff2?|ttf|otf|eot)$/i.test(fileName)) {
          fonts.push([fileName, output])
        }
        // 其余（位图等）原样保留，交给 Vite 落盘
      }

      if (!html) throw new Error('没有拿到 Vite 的 HTML 模板，无法生成产物')
      if (!entry) throw new Error('没有拿到入口 chunk，无法生成产物')

      // Vite 的输出目录基准由它自己解析，不猜路径：直接写进本次真正使用的目录
      const targetDir = this.environment.config.build.outDir
      const targetHtml = join(targetDir, 'index.html')

      const inlined = new Map()
      for (const [fileName, output] of fonts) {
        inlined.set(fileName, 'data:' + mimeOf(fileName) + ';base64,' + Buffer.from(output.source).toString('base64'))
      }

      const rewrite = (code: string) => {
        let out = code
        for (const [fileName, uri] of inlined) {
          out = out.split(fileName).join(uri)
          if (fileName.includes('/')) out = out.split(fileName.slice(fileName.lastIndexOf('/') + 1)).join(uri)
        }
        return out
      }

      const styles = rewrite(
        css.join('\\n').replace(/@font-face\\{[^}]*?-(?:vietnamese|cyrillic|cyrillic-ext|greek|greek-ext)-[^}]*?\\}/g, ''),
      )

      const finalHtml = html
        .replace(/<script[^>]*\\ssrc="[^"]*"[^>]*>\\s*<\\/script>\\s*/g, '')
        .replace(/<script[^>]*type="module"[^>]*>\\s*<\\/script>\\s*/g, '')
        .replace(/<link[^>]*rel="stylesheet"[^>]*>\\s*/g, '')
        .replace('</head>', '<style>\\n' + styles + '\\n</style>\\n</head>')
        .replace('</body>', '<script>\\n' + rewrite(entry.code) + '\\n</script>\\n</body>')

      if (/type="module"|sourceMappingURL/.test(finalHtml)) {
        throw new Error('自包含产物里仍残留模块脚本或 sourcemap 引用')
      }

      // 移除中间产物：HTML 模板、入口 JS、CSS 与已内联的字体；
      // 位图等资源保留，由 Vite 正常落盘。
      delete bundle[entry.fileName]
      for (const fileName of Object.keys(bundle)) {
        if (fileName.endsWith('.html') || fileName.endsWith('.css')) delete bundle[fileName]
      }
      for (const [fileName] of fonts) delete bundle[fileName]

      mkdirSync(targetDir, { recursive: true })
      writeFileSync(targetHtml, finalHtml, 'utf8')
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), selfContainedBundle()],
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    sourcemap: false,
    // 字体一律内联（避免 file:// 下字体被当成跨源请求拦截）；
    // 位图不内联 —— 图片没有 CORS 限制，社团头像留成独立文件能把页面从 2.4MB 降到 0.8MB。
    assetsInlineLimit: (filePath: string) => /\\.(woff2?|ttf|otf|eot)$/i.test(filePath),
    modulePreload: { polyfill: false },
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
})
`
}

/* --------------------------------------------------------------- 1. 校验上游 */
if (!fs.existsSync(path.join(SRC_DIR, 'package.json'))) {
  die(`找不到上游工程：${SRC_DIR}`)
}

/* ------------------------------------------- 2. 在临时目录准备一份可写副本 */
log(`准备临时构建目录 ${WORK_DIR}`)
fs.rmSync(WORK_DIR, { recursive: true, force: true })
fs.mkdirSync(WORK_DIR, { recursive: true })
const FILES = [
  'package.json',
  'package-lock.json',
  'index.html',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
]
for (const file of FILES) fs.cpSync(path.join(SRC_DIR, file), path.join(WORK_DIR, file))
for (const dir of ['src', 'image']) fs.cpSync(path.join(SRC_DIR, dir), path.join(WORK_DIR, dir), { recursive: true })

/* ------------------------------------------------- 3. 头像缩图（只改临时副本） */
const logo = optimizeLogo()
if (logo) {
  log(`社团头像已缩到 256×256：${(logo.bytes / 1024).toFixed(0)} KB（上游原图 1.2MB 保持不变）`)
  const npcConfig = path.join(WORK_DIR, 'src', 'config', 'npcConfig.ts')
  const patchedNpc = fs
    .readFileSync(npcConfig, 'utf8')
    .replace("from '../../image/科成-开放原子开源社团.png'", "from '../logo.png'")
  fs.writeFileSync(npcConfig, patchedNpc, 'utf8')
} else {
  log('警告：未能缩小社团头像，产物会因内联原图变大')
}

/* ------------------------------------------- 4. 打补丁（只改这份临时副本） */
log('写入 IIFE 构建配置；字体只保留 woff2 拉丁子集')
fs.writeFileSync(path.join(WORK_DIR, 'vite.config.ts'), viteConfig(), 'utf8')

const mainTsx = path.join(WORK_DIR, 'src', 'main.tsx')
const original = fs.readFileSync(mainTsx, 'utf8')
const patched = original
  .split('\n')
  .filter((line) => !line.includes("from '@fontsource-variable/manrope'"))
  .join('\n')
  // 原样保留 Barlow Condensed（榜单的 --display 数字字体），
  // 只把 Manrope 从 4 条单字重换成 1 条变量字体，省掉约 75KB 字体文件。
  .replace(
    "import { StrictMode } from 'react'",
    "import '@fontsource-variable/manrope'\nimport { StrictMode } from 'react'",
  )
fs.writeFileSync(mainTsx, patched, 'utf8')

/* ------------------------------------------------------------------ 5. 装依赖 */
const npm = resolveNpm()
log(`npm ci（只在临时目录写入，上游目录不受影响；用 ${path.basename(npm.command)} 执行）`)
try {
  runNpm(npm, ['ci', '--no-audit', '--no-fund'])
} catch {
  log('npm ci 失败，回退 npm install')
  runNpm(npm, ['install', '--no-audit', '--no-fund'])
}

/* -------------------------------------------------------------------- 6. 构建 */
log('vite build')
runViteBuild()

/* --------------------------------------------------- 7. 产物路径归一 + 自检 */
// Vite 的输出目录基准是它自己的配置根目录，可能与仓库根不一致，这里按实际情况搬运
if (!fs.existsSync(OUT_HTML)) {
  const distDir = path.join(WORK_DIR, 'dist')
  if (fs.existsSync(path.join(distDir, 'index.html'))) {
    log(`产物落在 ${distDir}，搬到 game-tenbase/`)
    fs.rmSync(OUT_DIR, { recursive: true, force: true })
    fs.cpSync(distDir, OUT_DIR, { recursive: true })
  }
}
if (!fs.existsSync(OUT_HTML)) die('构建结束但没有生成 game-tenbase/index.html')

/**
 * 头像归一：Vite 把 logo 落成 assets/logo-<hash>.png，
 * 这里复制成固定的 game-tenbase/logo.png（门户也引用它），并改写产物里的引用。
 * 幂等：已经归一过的产物直接判定为成功。
 */
function normalizeLogo() {
  const dest = path.join(OUT_DIR, 'logo.png')
  const isNormalized = () =>
    fs.existsSync(dest) && /logo\.png/.test(fs.readFileSync(OUT_HTML, 'utf8'))

  if (isNormalized()) return true

  const pngs = []
  const collect = (dir) => {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) collect(full)
      else if (entry.name.toLowerCase().endsWith('.png')) pngs.push(full)
    }
  }
  collect(OUT_DIR)
  const sources = pngs.filter((png) => path.resolve(png) !== path.resolve(dest))
  if (sources.length === 0) return isNormalized()

  const sourcePng = sources[0]
  fs.copyFileSync(sourcePng, dest)

  // 两种引用写法都要覆盖：
  //   1) Vite 资源 URL：new URL("logo-XXXX.png", document.currentScript ... || document.baseURI)
  //   2) 普通相对路径："assets/logo-XXXX.png"
  const base = path.basename(sourcePng)
  const targets = [base, `assets/${base}`, `./assets/${base}`]
  for (const entry of fs.readdirSync(OUT_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.(html|js|css)$/i.test(entry.name)) continue
    const full = path.join(OUT_DIR, entry.name)
    let text = fs.readFileSync(full, 'utf8')
    const before = text
    for (const target of targets) text = text.split(target).join('logo.png')
    if (text !== before) fs.writeFileSync(full, text, 'utf8')
  }

  for (const png of sources) fs.rmSync(png, { force: true })
  const assetDir = path.join(OUT_DIR, 'assets')
  if (fs.existsSync(assetDir) && fs.readdirSync(assetDir).length === 0) fs.rmdirSync(assetDir)
  return true
}

if (!normalizeLogo()) die('产物里没有找到社团头像 PNG，无法完成资源归一')

const html = fs.readFileSync(OUT_HTML, 'utf8')
if (/type="module"/.test(html)) die('产物仍是模块脚本，file:// 下无法直接打开')
if (/sourceMappingURL/.test(html)) die('产物仍引用 sourcemap')
if (/assets\//.test(html)) die('产物仍引用 assets/ 目录，说明有资源没有归一')

// 游戏里唯一的外部资源就是社团头像，缺了就是坏图 —— 必须硬失败
if (!/logo\.png/.test(html)) die('产物里找不到 logo.png 引用，社团头像会变成坏图')
if (!fs.existsSync(path.join(OUT_DIR, 'logo.png'))) die('产物目录里没有 logo.png 文件')

const inlinedPng = (html.match(/data:image\/png/g) ?? []).length
if (inlinedPng > 0) log(`注意：产物里内联了 ${inlinedPng} 张 PNG，页面会明显变大`)

/** 递归列出产物文件 */
function listOutput(dir, base = dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) listOutput(full, base, acc)
    else acc.push([path.relative(base, full).split(path.sep).join('/'), fs.statSync(full).size])
  }
  return acc
}

const files = listOutput(OUT_DIR)
files.sort((a, b) => a[0].localeCompare(b[0]))
let total = 0
for (const [name, size] of files) {
  total += size
  log(`  ${name}  ${(size / 1024).toFixed(1)} KB`)
}
log(`完成：game-tenbase/ 共 ${files.length} 个文件、${(total / 1024).toFixed(0)} KB`)

