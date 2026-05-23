# 语音输入法 — 使用指南

## 1. 项目简介

基于 Electron + Vosk 的桌面语音输入工具，支持离线流式语音识别和自动标点恢复。通过麦克风实时采集音频，由主进程 VAD 检测语音活动并送入 ASR 引擎，识别结果实时展示在输入面板。

## 2. 环境要求

| 依赖 | 最低版本 | 说明 |
|---|---|---|
| Node.js | >= 18 | 运行时的 JavaScript 引擎 |
| npm | >= 9 | 包管理（随 Node.js 一起安装） |
| Visual Studio Build Tools | — | **可选**，仅编译 Vosk 原生模块时需要 |

### 依赖安装

```bash
# 完整安装（含所有依赖）
cd voice-input
npm install

# 下载 Vosk 中文语音模型（~42MB，离线识别必需）
npm run download-model
```

模型也可手动下载后解压到 `models/vosk-model-small-cn-0.22/`：
- 下载地址：https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip

> 如果 Vosk 原生模块编译失败（缺少 C++ 构建工具），程序会自动降级到 Web Speech API 模式，在线识别功能不受影响。

## 3. 快速启动

```bash
# 命令 1：开发模式（同时启动 Vite + Electron）
npm run dev

# 命令 2：生产构建
npm run build && npm start

# 命令 3：仅启动渲染层开发服务器
npm run dev:renderer

# 命令 4：仅编译 Electron 主进程并启动
npm run dev:electron
```

`npm run dev` 为日常开发命令，它会：
1. 启动 Vite 开发服务器（端口 5173）
2. 等待服务器就绪后启动 Electron 窗口
3. Electron 加载 `http://localhost:5173`，支持 HMR 热更新

## 4. 使用流程

```
安装 → 启动 → 录音 → 语音输入 → 编辑/复制 → 导出
```

| 步骤 | 操作 | 说明 |
|---|---|---|
| **1. 启动** | `npm run dev` | 打开语音输入法窗口 |
| **2. 录音** | 点击 🎤 按钮 | 麦克风权限请求 → 开始录音 |
| **3. 语音输入** | 对着麦克风说话 | 实时显示识别文字（边说边出字） |
| **4. 自动标点** | 系统自动处理 | 句末加句号/问号，语音命令（逗号→，） |
| **5. 停止** | 再次点击 🎤 按钮 | 或等待 VAD 检测到静音自动结束 |
| **6. 编辑** | 复制/清空按钮 | 将结果复制到剪贴板 |
| **7. 查看历史** | 切换到"历史"标签 | 所有识别记录可查看和复制 |
| **8. 导出** | 历史页 → 导出按钮 | 弹出系统保存对话框，保存为 .txt 文件 |
| **9. 设置** | 切换到"设置"标签 | 配置热词、主题、识别引擎等 |

### 可选：长文本模式

在设置页开启"长文本模式"后，录音不会因静音自动停止，需手动点击停止按钮。适合会议录音、采访等长时间输入场景。

### 可选：热词管理

在设置页添加常用词汇（如"深度学习""卷积神经网络"），可提升这些词汇的识别准确率。支持设置权重（1-10）和纠错映射（如"张小姐"→"王小姐"）。

## 5. 运行测试

```bash
# 运行全部 103 个测试用例
npm test

# CI 模式（输出 JUnit 报告）
npm run test:ci

# 带覆盖率报告
npm run test:coverage

# 监听模式（开发时持续运行）
npm run test:watch

# 一键脚本（自动安装依赖 + 运行 + 保存报告）
bash tests/run_tests.sh          # Linux/Mac/Git Bash
tests\run_tests.bat              # Windows CMD
```

测试覆盖 6 个套件：
- **标点恢复**（39 用例）：句号/问号自动添加、语音命令替换、边界输入
- **VAD 检测**（17 用例）：状态转换 idle/speaking/pending_finalize、事件通知、自适应阈值
- **热词管理**（20 用例）：增删改查、权重钳位、持久化读写
- **云端 ASR**（11 用例）：启用/禁用、请求限流
- **Vosk 引擎**（8 用例）：原生模块不可用时的降级行为
- **集成流程**（3 用例）：标点 + 热词协同、VAD 完整对话时序

## 6. 文件结构与职责

```
voice-input/
├── package.json                  # 项目配置与依赖声明
├── tsconfig.json                 # 渲染进程 TypeScript 配置
├── tsconfig.electron.json        # Electron 主进程 TypeScript 配置
├── vite.config.ts                # Vite 构建配置
├── index.html                    # 渲染进程入口 HTML
│
├── electron/                     # 主进程（Node.js 环境）
│   ├── main.ts                   # 窗口管理、IPC 路由、应用生命周期
│   ├── preload.ts                # contextBridge 安全 API 暴露层
│   └── services/
│       ├── vosk-service.ts       # Vosk ASR 引擎：模型加载、流式识别、热词注入
│       ├── vad-service.ts        # VAD 引擎：能量+过零率检测、自适应阈值
│       ├── punctuation.ts        # 标点恢复：规则引擎、语音命令、数字格式化
│       ├── cloud-asr.ts          # 云端纠错：异步 API 封装、请求限流
│       └── hotword-manager.ts    # 热词管理：CRUD、持久化、纠错映射
│
├── src/                          # 渲染进程（浏览器环境）
│   ├── main.tsx                  # React 入口
│   ├── App.tsx                   # 应用壳：导航切换、主题 class 绑定
│   ├── App.css                   # 全局样式 + 深色主题变量
│   ├── vite-env.d.ts             # Vite 类型声明
│   ├── types/
│   │   └── index.ts              # 全部 TS 类型、IPC 通道常量、API 接口
│   ├── stores/
│   │   ├── recognition-store.ts  # 识别状态管理（Zustand）
│   │   └── settings-store.ts     # 设置状态管理（自动同步主进程）
│   ├── hooks/
│   │   ├── use-recognition.ts    # 录音控制 + 音频采集 + IPC 事件绑定
│   │   └── use-vad.ts            # VAD 状态映射 + 音频电平
│   └── components/
│       ├── VoiceInputPanel.tsx   # 主输入面板：录音按钮、文字显示、波形、统计
│       ├── StatusBar.tsx         # 底部状态栏：音频电平、引擎状态、错误提示
│       ├── Settings.tsx          # 设置页：引擎/语言/标点/热词/主题/长文本
│       └── History.tsx           # 历史记录：列表展示、复制、导出、清空
│
├── tests/                        # 测试套件
│   ├── jest.config.js            # Jest 配置（ts-jest 编译）
│   ├── punctuation.test.ts       # 标点恢复测试
│   ├── vad-service.test.ts       # VAD 引擎测试
│   ├── hotword-manager.test.ts   # 热词管理测试
│   ├── cloud-asr.test.ts         # 云端 ASR 测试
│   ├── vosk-service.test.ts      # Vosk 引擎降级测试
│   ├── recognition-flow.test.ts  # 集成流程测试
│   ├── run_tests.sh              # 一键运行脚本 (Unix)
│   └── run_tests.bat             # 一键运行脚本 (Windows)
│
├── scripts/
│   └── download-model.js         # Vosk 模型下载器
│
├── models/                       # Vosk 模型文件（需下载）
└── resources/                    # 应用图标等资源
```

## 7. 设计决策

### 技术选型

| 决策 | 方案 | 理由 |
|---|---|---|
| 桌面框架 | Electron 30 | 跨平台，JS 全栈，UI 表现力强，评审演示方便 |
| 离线 ASR | Vosk (npm 包) | 中文模型成熟（~42MB），流式延迟 <300ms，满足 P0 离线需求 |
| 在线 ASR | Web Speech API | 浏览器内置，零成本，用户不用配置 API Key |
| 前端框架 | React 18 + Vite | 快速开发，HMR 开发体验好 |
| 状态管理 | Zustand | 轻量（~1KB），无 boilerplate，TS 类型推导 |
| VAD 方案 | 能量检测 + 过零率 | 纯 JS 实现，不需要额外模型或 native 模块，安静环境足够准确 |
| 标点恢复 | 规则引擎 | 无模型依赖，零延迟，覆盖日常 90% 场景 |

### 音频数据流设计

```
渲染进程: getUserMedia → AudioContext(16kHz) → ScriptProcessorNode
                                                      ↓ PCM Float32Array
                                                    IPC (ipcRenderer.send)
                                                      ↓
主进程:   VAD.processAudio() → Vosk.feedAudio()
              ↓                      ↓
         stateChange             partial/final
              ↓                      ↓
            IPC (webContents.send)
              ↓
渲染进程: React 状态更新 → UI 渲染
```

**关键设计点**：
- 音频采样率统一为 16kHz（Vosk 输入要求）
- 渲染进程只负责采集和显示，所有计算在主进程
- 音频块通过 `ipcRenderer.send`（单向，无返回）发送，不阻塞渲染
- 识别结果通过 `webContents.send` 从主进程推送到渲染进程

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

- 模式切换：`auto` 模式静音超时自动进入 pending_finalize；`manual` 模式仅在用户手动点击时停止
- 自适应阈值：前 200 帧建立噪声基底，后续动态调整
- 能量计算：RMS + 过零率惩罚（高 ZCR 视为噪声）

### IPC 安全方案

```
渲染进程 ─── contextBridge ───→ 主进程
   │                              │
   │ 仅能调用 VoiceInputAPI       │ 注册 ipcMain.handle / ipcMain.on
   │ 中明确定义的方法             │ 所有敏感操作（文件、权限）在主进程
   │                              │
   └── 无法 require('electron') ──┘
```

- 使用 `contextIsolation: true` + `nodeIntegration: false`
- 通过 `preload.ts` 的 `contextBridge.exposeInMainWorld` 暴露有限 API
- 所有文件操作（导出文本、热词持久化）在主进程执行
- 麦克风权限通过 `session.setPermissionRequestHandler` 管理

### 错误处理策略

- Vosk 模块加载失败 → 自动降级到 Web Speech API，不阻塞启动
- 麦克风权限被拒 → UI 显示错误提示，按钮可用
- 识别过程异常 → 日志记录静默恢复，不中断录音
- 导出文件取消 → `dialog.showSaveDialog` 取消时返回 `{ success: false }`，不崩溃
