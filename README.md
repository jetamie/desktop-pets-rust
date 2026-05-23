# 桌面宠物 Tauri 版

一个基于 Tauri + TypeScript Windows 桌面宠物应用。应用会在桌面上显示透明置顶的小宠物，支持问候语、跳跃、移动、边缘行走、时间轴移动、系统托盘配置和运行时热加载配置。

## 功能特性

- 透明无边框桌宠窗口，置顶显示，不占用主任务栏。
- 系统托盘菜单：
  - `配置`：打开独立配置窗口。
  - `退出`：关闭应用。
- 宠物右键菜单：
  - `跳跃`
  - `移动`
- 支持切换宠物：
  - `cat`
  - `totoro`
  - `totoro-v2`
- 支持配置热加载：
  - 问候间隔 `interval_seconds`
  - 移动速度 `move_speed`
  - 宠物尺寸 `pet_size`
  - 当前宠物 `current_pet`
  - 当前模式 `current_mode`
  - 模式调度 `game_modes.schedules`
- 支持多种行为模式：
  - `wander`：随机闲逛。
  - `edge`：沿屏幕边缘移动。
  - `timeline`：根据时间在屏幕底部移动。
- 打包时自动携带配置和宠物资源。

## 技术栈

- [Tauri 2](https://tauri.app/)
- Rust
- TypeScript
- Vite
- Vitest

## 目录结构

```text
.
├── assets/                 # 宠物素材资源
│   └── pets/
│       ├── cat/
│       ├── totoro/
│       └── totoro-v2/
├── config/                 # 默认应用配置
│   └── config.json
├── src/                    # 前端逻辑
│   ├── configPanel.ts      # 配置窗口
│   ├── desktopPet.ts       # 桌宠主逻辑
│   ├── gameMode.ts         # 模式管理
│   ├── petLogic.ts         # 纯逻辑工具
│   ├── tauriApi.ts         # Tauri API 适配
│   └── types.ts            # 前端类型定义
├── src-tauri/              # Tauri / Rust 后端
│   ├── src/
│   │   ├── lib.rs          # Tauri 命令、窗口、托盘
│   │   ├── models.rs       # Rust 配置模型
│   │   └── resources.rs    # 配置和资源读取
│   └── tauri.conf.json
├── index.html
├── package.json
└── vite.config.ts
```

## 环境要求

- Windows 10/11
- Node.js
- npm
- Rust 工具链
- Tauri 2 所需系统依赖

如果本机尚未配置 Tauri 开发环境，请先参考 Tauri 官方文档安装 Rust、Node.js 和 Windows 相关依赖。

## 安装依赖

```bash
npm install
```

## 开发运行

```bash
npm run dev
```

该命令会启动 Vite 开发服务器，并通过 Tauri 启动桌面应用。

如只需要启动前端开发服务器：

```bash
npm run dev:frontend
```

## 测试与类型检查

运行 TypeScript 类型检查：

```bash
npm run typecheck
```

运行前端单元测试：

```bash
npm run test:run
```

运行 Rust 测试：

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

## 打包构建

```bash
npm run build
```

构建完成后，常见产物位置：

```text
src-tauri/target/release/desktop-pets-rust.exe
src-tauri/target/release/bundle/msi/桌面宠物_1.2.0_x64_zh-CN.msi
src-tauri/target/release/bundle/nsis/桌面宠物_1.2.0_x64-setup.exe
```

## 配置说明

默认配置位于：

```text
config/config.json
```

应用首次运行时会把默认配置复制到用户配置目录，之后运行时保存配置只会修改用户配置，不会修改项目内的默认配置文件。

常用配置字段：

| 字段 | 说明 |
| --- | --- |
| `current_pet` | 当前宠物，可在配置窗口中选择 `cat`、`totoro`、`totoro-v2`。 |
| `current_mode` | 当前模式覆盖。为 `null` 或不存在时按调度规则自动选择。 |
| `interval_seconds` | 问候语显示间隔，单位秒。 |
| `display_duration_seconds` | 问候语显示持续时间，单位秒。 |
| `move_speed` | 宠物移动速度。 |
| `idle_timeout_seconds` | 空闲多久后自动移动，单位秒。 |
| `pet_size` | 桌宠窗口和绘制尺寸。 |
| `bottom_margin` | 距离屏幕底部的边距。 |
| `animation_interval_ms` | 动画帧切换间隔，单位毫秒。 |
| `game_modes` | 模式定义和调度规则。 |
| `greetings` | 不同时段的问候语。 |

## 桌宠模式说明

### wander

闲逛模式。宠物会在屏幕范围内随机移动。

### edge

边路模式。宠物会沿屏幕边缘路径移动。路径配置示例：

```json
{
  "path": "right->bottom->left->top->top_to_right->right"
}
```

### timeline

时间轴模式。宠物会根据当前时间在屏幕底部从右向左移动。通常配合调度规则的 `start_time` 和 `end_time` 使用。

## 配置窗口

系统托盘右键点击 `配置` 可打开独立配置窗口。当前支持修改：

- 当前宠物
- 问候间隔
- 移动速度
- 宠物尺寸
- 当前模式
- 模式调度规则

点击 `保存并应用` 后，主桌宠窗口会通过 `config-changed` 事件实时应用配置。

## 宠物资源

宠物资源位于：

```text
assets/pets/<pet-name>/
```

每个宠物目录需要包含：

```text
config.json
```

宠物配置中通过 `frames` 定义不同状态对应的图片文件，例如：

```json
{
  "name": "龙猫-v2",
  "size": 2048,
  "frames": {
    "idle": ["1.png", "2.png"],
    "walk": ["1.png"],
    "jump": ["1.png", "2.png", "3.png"]
  }
}
```

## 常见问题 / 注意事项

### 修改 `config/config.json` 后没有生效

应用运行后会优先读取用户配置目录中的配置。项目内 `config/config.json` 主要作为首次运行时的默认配置。如果已经运行过应用，需要在配置窗口保存，或清理用户配置后重新启动应用。

### 打包时提示 exe 文件无法删除

如果 `src-tauri/target/release/desktop-pets-rust.exe` 正在运行，或者被系统短暂占用，构建可能失败。关闭正在运行的桌宠后重新执行：

```bash
npm run build
```

### 托盘里找不到应用

应用不会显示在主任务栏，主要通过 Windows 系统托盘操作。可以在托盘菜单中打开配置或退出应用。

### 图片显示异常

确认宠物目录在 `assets/pets/<pet-name>/` 下，并且 `config.json` 中的图片文件名与实际文件一致。
