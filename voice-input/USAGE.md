# 语音输入法 — 使用指南

## 1. 项目简介

基于 Electron + React 的桌面语音输入工具，支持 Web Speech API 在线识别和 Vosk 离线识别双引擎自动切换。通过浏览器内置语音识别或本地 Vosk 引擎将语音实时转为文字，支持自动标点、热词定制、深色主题等。

## 2. 环境要求

| 依赖 | 最低版本 | 说明 |
|---|---|---|
| Node.js | >= 18 | 运行时 |
| npm | >= 9 | 包管理 |
| 浏览器 | Chrome / Edge | Web Speech API 识别需要 Chromium 内核 |
| Visual Studio Build Tools | — | **可选**，仅使用 Vosk 离线引擎时需要 |

### 安装

```bash
# 安装项目依赖
cd voice-input
npm install

# 下载 Vosk 中文语音模型（仅使用 Vosk 离线引擎时需要）
npm run download-model
```

模型也可手动下载后解压到 `models/vosk-model-small-cn-0.22/`：
- https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip

> **注意**：Vosk 为可选依赖。未安装 Vosk 或编译失败时，程序自动使用浏览器 Web Speech API 进行识别，无需任何额外配置。

## 3. 快速启动

```bash
# 方式一：浏览器模式（推荐，无需 Electron）
npm run dev:renderer
# → 用 Chrome 打开 http://localhost:5173

# 方式二：Electron 桌面模式 由于Vosk 原生模块不可用，降级到 Web Speech API 模式:  所以当前只支持浏览器模式
npm run dev

# 方式三：生产构建
# npm run build 
# npm start
```

`npm run dev` 会同时启动 Vite 开发服务器（端口 5173）和 Electron 窗口，支持 HMR 热更新。

## 4. 使用流程

```
启动 → 录音 → 语音输入 → 编辑/导出 → 设置
```

| 步骤 | 操作 | 说明 |
|---|---|---|
| **1. 启动** | `npm run dev:renderer` → Chrome 打开 | 或 `npm run dev` 直接启动 Electron |
| **2. 录音** | 点击 🎤 按钮 | 浏览器弹出麦克风权限请求 → 允许 |
| **3. 语音输入** | 对着麦克风说话 | 文字实时显示（边说边出字） |
| **4. 停止** | 再次点击 🎤 按钮 | 识别结束，文字保留在面板 |
| **5. 编辑** | 复制/清空按钮 | 将结果复制到剪贴板 |
| **6. 查看历史** | 切换到"历史"标签 | 所有识别记录可查看、复制、导出 |
| **7. 导出** | 历史页 → 📥 导出按钮 | 浏览器中直接下载 .txt 文件 |
| **8. 设置** | 切换到"设置"标签 | 配置热词、主题、引擎、长文本模式等 |

### 引擎与模式说明

| 模式 | 识别引擎 | 是否需要安装 | 离线可用 |
|---|---|---|---|
| **浏览器模式** (`dev:renderer`) | Chrome Web Speech API | 无需安装 | ❌（需联网） |
| **Electron 无 Vosk** (`dev`) | Web Speech API（Chromium） | 无需安装 | ❌（需联网） |
| **Electron + Vosk** | Vosk 离线引擎 | 需 VS Build Tools + 模型 | ✅ |

### 热词管理

设置页 → 添加常用词汇（如"深度学习"），可提升这些词汇的识别准确率。支持：
- 权重设置（1-10）
- 纠错映射（如"张小姐" → "王小姐"）
- 自动持久化

### 深色主题

设置页 → 外观 → 选择"🌙 深色"，全局即时切换。

### 长文本模式

设置页 → 开启后录音不会因静音自动停止，需手动点击停止按钮。适合会议录音、采访等长时间输入。

## 5. 运行测试

```bash
# 运行全部 103 个测试用例
npm test

# CI 模式（输出 JUnit 报告到 tests/reports/）
npm run test:ci

# 带覆盖率报告
npm run test:coverage

# 监听模式（开发时持续运行）
npm run test:watch

# 一键脚本
bash tests/run_tests.sh          # Linux/Mac/Git Bash
tests\run_tests.bat              # Windows CMD
```

测试覆盖 6 个套件：
- **标点恢复**（39 用例）：句号/问号自动添加、语音命令替换、边界输入
- **VAD 检测**（17 用例）：状态转换、事件通知、自适应阈值
- **热词管理**（20 用例）：增删改查、权重钳位、持久化读写
- **云端 ASR**（11 用例）：启用/禁用、请求限流
- **Vosk 引擎降级**（8 用例）：原生模块不可用时的降级行为
- **识别流程集成**（3 用例）：标点 + 热词协同、VAD 完整对话时序

## 6. 文件结构与职责

```
voice-input/
├── package.json                  # 项目配置：依赖、脚本、构建
├── tsconfig.json                 # 渲染进程 TypeScript 配置
├── tsconfig.electron.json        # Electron 主进程 TypeScript 配置
├── vite.config.ts                # Vite 构建配置
├── index.html                    # 渲染进程入口 HTML
│
├── electron/                     # 主进程（Node.js 环境）
│   ├── main.ts                   # 窗口管理、IPC 路由、应用生命周期、权限处理
│   ├── preload.ts                # contextBridge 安全 API 暴露层
│   ├── types.ts                  # Electron 进程内部类型（镜像 src/types）
│   └── services/
│       ├── vosk-service.ts       # Vosk ASR 引擎：模型加载、流式识别、热词注入
│       ├── vad-service.ts        # VAD 引擎：能量+过零率检测、状态机、自适应阈值
│       ├── punctuation.ts        # 标点恢复：句末标点、语音命令、数字格式化
│       ├── cloud-asr.ts          # 云端纠错：API 封装、请求限流
│       └── hotword-manager.ts    # 热词管理：CRUD、持久化、纠错映射
│
├── src/                          # 渲染进程（浏览器环境）
│   ├── main.tsx                  # React 入口
│   ├── App.tsx                   # 应用壳：三标签导航、深色主题 class 绑定
│   ├── App.css                   # 全局样式 + CSS 变量 + 深色主题
│   ├── vite-env.d.ts             # Vite 类型声明
│   ├── types/
│   │   └── index.ts              # TS 类型、IPC 通道、API 接口定义
│   ├── stores/
│   │   ├── recognition-store.ts  # 识别状态管理（Zustand）：录音、文字、引擎状态
│   │   └── settings-store.ts     # 设置状态管理：持久化同步
│   ├── hooks/
│   │   ├── use-recognition.ts    # 录音核心 Hook：Vosk IPC + Web Speech API 双路径
│   │   └── use-vad.ts            # VAD 状态映射 + 音频电平
│   └── components/
│       ├── VoiceInputPanel.tsx   # 主输入面板：录音按钮、波形动画、文字、统计
│       ├── StatusBar.tsx         # 状态栏：音频电平条、引擎状态、VAD 提示
│       ├── Settings.tsx          # 设置页：引擎/语言/标点/热词/主题/长文本
│       └── History.tsx           # 历史页：记录列表、复制、导出、清空
│
├── tests/                        # 测试套件
│   ├── jest.config.js            # Jest 配置（ts-jest 编译）
│   ├── punctuation.test.ts       # 标点恢复 · 39 用例
│   ├── vad-service.test.ts       # VAD 引擎 · 17 用例
│   ├── hotword-manager.test.ts   # 热词管理 · 20 用例
│   ├── cloud-asr.test.ts         # 云端 ASR · 11 用例
│   ├── vosk-service.test.ts      # Vosk 降级 · 8 用例
│   ├── recognition-flow.test.ts  # 集成流程 · 3 用例
│   ├── run_tests.sh              # 一键运行 (Unix)
│   └── run_tests.bat             # 一键运行 (Windows)
│
├── scripts/
│   └── download-model.js         # Vosk 模型下载脚本
│
└── models/                       # Vosk 模型文件（仅离线引擎需要）
```

## 7. 设计决策

### 技术选型

| 决策 | 方案 | 理由 |
|---|---|---|
| 桌面框架 | Electron 30 | 跨平台，JS 全栈，UI 表现力强 |
| 离线 ASR | Vosk（可选） | 中文模型成熟，流式延迟低，满足 P0 离线需求 |
| 在线 ASR | Web Speech API | 浏览器内置、零成本、无需 API Key，Vosk 不可用时自动降级 |
| 前端框架 | React 18 + Vite | 快速开发，HMR 热更新 |
| 状态管理 | Zustand | 轻量（~1KB），无 boilerplate，TS 类型推导 |
| VAD 检测 | 能量 + 过零率 | 纯 JS 实现，无需 native 模块，安静环境足够准确 |
| 标点恢复 | 规则引擎 | 无模型依赖，零延迟，覆盖日常 90% 场景 |

### 引擎降级策略

```
Electron 启动
     ↓
voskService.init()
     ↓
┌─── 成功 ───→ Vosk Model 加载 → 引擎类型: 'vosk'
│
└─── 失败 ───→ 引擎类型: 'webspeech'
                    ↓
用户点击录音按钮
     ↓
engineType === 'vosk'?
     ↓                    ↓
  是: IPC 路径           否 → Web Speech API 路径
  (主进程 VAD+Vosk)           (渲染进程 SpeechRecognition)
     ↓                           ↓
 识别结果 → IPC → UI        识别结果 → 直接 → UI
```

**两种路径对比：**

|  | Vosk 路径（Electron） | Web Speech 路径（浏览器） |
|---|---|---|
| 识别引擎 | Vosk 离线 ASR | Chrome 内置语音识别 |
| 处理位置 | 主进程（Node.js） | 渲染进程（浏览器） |
| 数据流 | 音频 PCM → IPC → VAD → Vosk → IPC → UI | getUserMedia → SpeechRecognition → UI |
| 是否需要网络 | 否（完全离线） | 是（连接 Google 语音服务） |
| VAD 控制 | 主进程 VAD 引擎控制 | 浏览器自动处理 |

### VAD 状态机

```
        ┌──────────────────────────────────┐
        │                                  │
        ▼  检测到语音(能量>阈值)            │
   ┌────────┐ ──────────────────► ┌────────┐
   │  IDLE  │                     │SPEAKING│
   └────────┘                     └────────┘
                                      │
                  静音超时(>500ms)     │ 检测到语音(续说)
                                      │
                                      ▼
                              ┌──────────────┐
                              │PENDING_FINALIZE│
                              └──────────────┘
                                      │
                              静音持续 → 自动停止
```

- 模式切换：`auto` 模式静音超时自动进入 pending_finalize；`manual` 模式（长文本）仅在用户手动点击时停止
- 自适应阈值：前 200 帧建立噪声基底，后续动态调整
- 能量计算：RMS + 过零率惩罚（高 ZCR 视为噪声）

### IPC 安全方案

```
渲染进程 ─── contextBridge ───→ 主进程
   │                              │
   │ 仅能调用 VoiceInputAPI       │ 注册 ipcMain.handle / ipcMain.on
   │ 中明确定义的方法             │ 所有敏感操作（文件、权限）在主进程
   │                              │
   └── 无法直接访问 Node.js API ──┘
```

- `contextIsolation: true` + `nodeIntegration: false`
- `preload.ts` 通过 `contextBridge.exposeInMainWorld` 暴露有限 API
- 文件操作（导出文本、热词持久化）在拥有文件系统权限的主进程执行
- 麦克风权限通过 `session.setPermissionRequestHandler` 在 Electron 中管理

### 错误处理策略

- **Vosk 模块不可用** → 自动检测并降级到 Web Speech API，状态栏显示当前引擎
- **Web Speech API 不可用** → 提示用户使用 Chrome 浏览器访问本地服务
- **麦克风权限被拒** → UI 显示错误提示，按钮保持可用
- **导出文件取消** → 浏览器中直接下载 .txt 文件，Electron 中弹出系统保存对话框
- **语音识别异常** → onerror 捕获并显示错误信息，不中断应用运行
- **模型文件不兼容** → resolveModelPath 严格验证 am 文件格式，拒绝不兼容模型以防 segfault
