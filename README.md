# dsh-workspace-launcher

给 DSH 的 session 顶部加一个**工作区环境启动入口**：一个紧凑的分裂按钮，左段一键启动/停止全部环境，右段弹出下拉逐条选择。

```
[ ▶ 启动 | ▾ ]        ← 未运行时
[ ■ 停止 | ▾ ]        ← 有环境在运行时
[ 配置启动命令 ]       ← 该工作区还没配置时，点一下就去配置
```

下拉菜单的内容：

- 每条环境一行：状态点 + 名称 + 状态（`可访问` / 启动中 / 已停止 / 失败），行尾两个小按钮 —— `↗` 打开访问地址、`☰` 查看实时日志。
- `▶ 全部启动` / `■ 停止全部`（有环境在跑时才出现）。
- `⚙ 配置命令`：编辑当前工作区的环境列表。

点空白处、按 Esc、滚动或改变窗口大小都会收起下拉。入口只在有工作目录的会话里出现；空白会话（hero）和已有会话各占一个座位，同一时刻只渲染一个。

## 安装

本机（DSH desktop profile）：

```sh
ln -s "$PWD" ~/.dsh/profiles/desktop/node_modules/dsh-workspace-launcher
```

然后在 profile 的 `cordis.patch.yml` 里加上本包自带的插件行（见仓库里的 `cordis.patch.yml`），或者用插件面板启用。客户端改动刷新页面即生效；宿主端改动需要重启 DSH。

包内的 `cordis.patch.yml` 声明插件行 `- id: session-launcher`。宿主端依赖 `connection` 服务，浏览器端依赖官方的 `@deepseek-ai/dsh-client-ui-conversation` 与 `@deepseek-ai/dsh-client-ui-slots`。宿主 Fetch route 复用 DSH 自带的认证与 Host/Origin 检查。

## 配置

配置**按工作区（session 的工作目录）保存**，可以分别加前端、后端、数据库等。运行目录可以填相对工作区的路径。

加载优先级：

1. 界面里保存的配置（`~/.dsh/session-launcher.json`）
2. 项目根目录的 `.dsh-launcher.json`
3. 根目录 `package.json` 的 scripts（`dev:backend`、`dev:server`、`dev:frontend`、`dev:client`，或 `dev` / `start`）

`.dsh-launcher.json` 示例：

```json
{
  "services": [
    { "id": "backend", "name": "后端", "command": "npm run dev", "cwd": "server", "url": "http://localhost:3001" },
    { "id": "frontend", "name": "前端", "command": "npm run dev", "cwd": "client", "url": "http://localhost:3000" }
  ]
}
```

最多 16 条。`name` 与 `command` 必填，`url` 必须是 http(s)。

## 进程行为

- 每条命令跑在独立的 shell 进程里（POSIX 下 `$SHELL -lc` 并自成进程组，Windows 走 `cmd /c`）。
- 日志留在宿主内存里（每条最近约 64 KB），切换会话或刷新浏览器都不会丢。
- 同一个工作区的会话共享配置和运行状态。
- 启动前先探测访问地址；已经在跑的（比如你自己开的 dev server）会标记为“已在运行”，不会重复拉起。
- 停止只结束启动器自己创建的进程；POSIX 下先 SIGTERM，3 秒后 SIGKILL 整个进程组。
- 禁用插件或退出 DSH 会结束这些进程。

## 开发

```sh
npm test
```

测试覆盖：前后端并行启动、重复启动去重、失败隔离、日志、进程组结束、配置保存、scripts 探测、外部服务复用。

## 目录

```
src/manager.js   宿主进程管理（配置、探测、spawn/kill、日志）
src/runtime.js   宿主 Fetch route（POST /api/session-launcher）
src/client.js    浏览器入口（分裂按钮、下拉、配置弹窗、日志弹窗）
test/            单元测试
```
