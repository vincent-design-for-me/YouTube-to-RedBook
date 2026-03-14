# 项目架构说明

本文档详细说明项目的目录结构和各个文件夹的职责。

## 目录结构总览

```
transcript-app/
├── app/                    # Next.js App Router 目录
├── components/             # React 组件
├── lib/                    # 核心业务逻辑和工具
├── public/                 # 静态资源
└── [配置文件]
```

---

## 📁 核心目录详解

### `app/` - Next.js App Router

Next.js 16 的 App Router 目录，包含所有页面、布局和 API 路由。

```
app/
├── api/                    # API 路由
│   └── transcript/
│       └── route.ts        # POST /api/transcript - 获取 YouTube 字幕
├── error.tsx               # 错误边界组件（捕获运行时错误）
├── layout.tsx              # 根布局（全局 HTML 结构、字体）
├── not-found.tsx           # 404 页面
├── page.tsx                # 首页（主应用界面）
└── globals.css             # 全局样式
```

**职责：**
- 定义应用的路由结构
- 处理页面渲染和 API 请求
- 提供错误处理和布局

**命名规范：**
- `page.tsx` - 页面组件
- `layout.tsx` - 布局组件
- `route.ts` - API 路由处理器
- `error.tsx` - 错误边界
- `not-found.tsx` - 404 页面

---

### `components/` - React 组件

可复用的 React 组件，按功能分组。

```
components/
└── ui/                     # UI 基础组件
    ├── loading-skeleton.tsx    # 加载骨架屏
    └── transcript-list.tsx     # 字幕列表展示
```

**职责：**
- 提供可复用的 UI 组件
- 封装展示逻辑
- 保持组件的单一职责

**组织原则：**
- `ui/` - 基础 UI 组件（按钮、输入框、骨架屏等）
- 未来可扩展：
  - `features/` - 功能组件（如完整的表单、卡片）
  - `layout/` - 布局组件（如 Header, Footer）

**命名规范：**
- 使用 kebab-case（如 `loading-skeleton.tsx`）
- 组件名应该描述其功能，而非实现细节

---

### `lib/` - 核心业务逻辑

应用的核心逻辑库，包含类型定义、工具函数和 API 相关代码。

```
lib/
├── api/                    # API 相关
│   └── errors.ts           # 错误类定义和错误处理
├── types/                  # TypeScript 类型定义
│   └── transcript.ts       # 字幕相关的类型接口
└── utils/                  # 工具函数
    ├── extract-video-id.ts # 从 URL 提取 YouTube 视频 ID
    └── format-time.ts      # 时间格式化（秒 → MM:SS）
```

**职责：**
- `api/` - API 客户端、错误处理、请求封装
- `types/` - 全局类型定义、接口声明
- `utils/` - 纯函数工具、格式化、验证等

**组织原则：**
- 按功能领域分组（api, types, utils）
- 每个文件只包含相关的功能
- 保持函数的纯粹性和可测试性

**命名规范：**
- 文件名使用 kebab-case
- 函数名使用 camelCase
- 类型/接口使用 PascalCase

---

### `public/` - 静态资源

存放静态文件，可以通过根路径直接访问。

```
public/
├── next.svg                # Next.js logo
├── vercel.svg              # Vercel logo
└── [其他静态资源]
```

**职责：**
- 存放图片、字体、图标等静态文件
- 存放 `robots.txt`, `sitemap.xml` 等 SEO 文件

**访问方式：**
- `public/logo.png` → `/logo.png`

---

## 📄 配置文件说明

### 根目录配置文件

| 文件 | 用途 |
|------|------|
| `package.json` | Node.js 项目配置、依赖管理 |
| `tsconfig.json` | TypeScript 编译配置 |
| `next.config.ts` | Next.js 框架配置 |
| `tailwind.config.ts` | Tailwind CSS 配置 |
| `postcss.config.mjs` | PostCSS 配置 |
| `eslint.config.mjs` | ESLint 代码检查配置 |
| `.gitignore` | Git 忽略文件配置 |

---

## 🎯 设计原则

### 1. 关注点分离
- **UI 组件** (`components/`) - 只负责展示
- **业务逻辑** (`lib/`) - 数据处理和工具函数
- **路由和 API** (`app/`) - 请求处理和页面路由

### 2. 单一职责
- 每个文件只做一件事
- 每个函数只有一个明确的目的
- 组件保持小而专注

### 3. 可维护性
- 清晰的命名
- 完整的类型定义
- JSDoc 注释
- 模块化设计

### 4. 可扩展性
- 按功能分组，便于添加新功能
- 松耦合设计，便于替换实现
- 统一的错误处理机制

---

## 🔄 数据流

```
用户输入
  ↓
app/page.tsx (UI)
  ↓
fetch → app/api/transcript/route.ts (API)
  ↓
lib/utils/extract-video-id.ts (工具)
  ↓
youtube-transcript (外部库)
  ↓
lib/types/transcript.ts (类型)
  ↓
components/ui/transcript-list.tsx (展示)
  ↓
用户查看结果
```

---

## 📚 扩展建议

未来可以考虑添加的目录：

```
├── hooks/                  # 自定义 React Hooks
├── contexts/               # React Context 提供者
├── constants/              # 常量定义
├── services/               # 外部服务集成
├── tests/                  # 测试文件
└── docs/                   # 详细文档
```

---

## 🤝 贡献指南

添加新功能时：

1. **新组件** → `components/ui/` 或 `components/features/`
2. **新工具函数** → `lib/utils/`
3. **新类型** → `lib/types/`
4. **新 API** → `app/api/[功能名]/route.ts`
5. **新页面** → `app/[路由名]/page.tsx`

记得：
- 添加 TypeScript 类型
- 编写 JSDoc 注释
- 保持命名一致性
- 更新此文档
