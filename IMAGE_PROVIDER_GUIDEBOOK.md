# 图片生成供应商配置 Guidebook

> 写给非技术同学的操作手册。不需要懂代码，只需要知道改哪里、改什么。

---

## 一、背景：这次改了什么？

### 问题
原来的代码里，图片生成的参数（比如画质、比例）散落在各处，想换一个图片生成服务商，要改好几个地方，容易出错。

### 解决方案
这次重构做了一件事：**把所有"换供应商需要改的东西"集中到两个地方**：

1. `.env.local` — 填供应商的地址和密钥（类似账号密码）
2. `lib/config/image.ts` — 填图片的默认参数（画质、比例）

改完这两个文件，整个项目就能跑起来，不需要动其他任何代码。

---

## 二、改动清单

### 改动 1：`lib/config/env.ts`
**改了什么：** 新增了对 `IMAGE_API_FORMAT=wuai` 这个格式的支持，删除了多余的 `IMAGE_API_TOKEN` 变量（合并到 `IMAGE_API_KEY` 统一管理）。

**你不需要动这个文件。** 它只是读取 `.env.local` 里的变量，传给图片生成模块用。

---

### 改动 2：`lib/llm/image-provider.ts`
**改了什么：** 新增了对 **wuaiapi** 这家供应商的支持。

这家供应商的接口比较特殊——它不是"发请求立刻拿到图片"，而是"先提交任务，再轮询等待结果"（类似网上下单，然后刷新页面看有没有发货）。代码里处理了这个等待逻辑，最终对外表现还是一样的：你发一个 prompt，拿回一张图。

现在支持的供应商类型：

| 类型标识 | 适用场景 |
|---------|---------|
| `gemini-native` | Google 官方或兼容 Gemini 格式的代理 |
| `openai-compat` | 兼容 OpenAI 格式的代理 |
| `wuai` | wuaiapi.com 这家供应商 |

---

### 改动 3：新建 `lib/config/image.ts`（核心）
**改了什么：** 新建了一个专门存放图片默认参数的文件。

```
ratio: '3:4'       → 图片比例（竖版）
resolution: '4k'   → 图片画质
```

**这是以后调整图片参数的唯一入口。**

---

### 改动 4：`lib/services/generation-pipeline.ts`
**改了什么：** 让生成流程在调用图片接口时，主动把 `lib/config/image.ts` 里的参数传过去，而不是各自为政地写死在底层。

**你不需要动这个文件。**

---

## 三、日常操作手册

### 场景 A：换一家图片生成供应商

只需要改 `.env.local` 文件（项目根目录下），更新以下几行：

```
IMAGE_BASE_URL=    ← 供应商给你的 API 地址
IMAGE_API_KEY=     ← 供应商给你的密钥或 Token
IMAGE_API_FORMAT=  ← 供应商的接口类型（见下表）
IMAGE_MODEL=       ← 模型名（wuai 不需要填这行）
```

**不同供应商怎么填：**

| 供应商 | IMAGE_BASE_URL | IMAGE_API_KEY | IMAGE_API_FORMAT | IMAGE_MODEL |
|--------|---------------|--------------|-----------------|------------|
| Google 官方直连 | （不填） | （不填） | `gemini-native` | （不填） |
| newapi / newcoin 等代理 | 代理地址 | 代理的 key | `gemini-native` | 模型名 |
| OpenAI 兼容代理 | 代理地址 | 代理的 key | `openai-compat` | 模型名 |
| wuaiapi.com | `https://nb.wuaiapi.com` | wuai 的 Bearer Token | `wuai` | （不填） |

> **获取 wuai Token 的方法：**
> 用你的账号调用 `POST https://nb.wuaiapi.com/api/auth/login`，传入用户名和密码，返回结果里的 `token` 字段就是 `IMAGE_API_KEY` 的值。

---

### 场景 B：调整图片画质或比例

打开文件：`lib/config/image.ts`

```ts
export const IMAGE_DEFAULTS: ImageOptions = {
  ratio: '3:4',       // ← 改这里调整比例
  resolution: '4k',   // ← 改这里调整画质
};
```

**ratio 可选值（图片比例）：**

| 值 | 效果 |
|----|------|
| `1:1` | 正方形 |
| `3:4` | 竖版（小红书常用） |
| `4:3` | 横版 |
| `16:9` | 宽屏横版 |
| `9:16` | 竖屏（手机全屏） |

**resolution 可选值（画质）：**

| 值 | 效果 | wuai 积分消耗 |
|----|------|------------|
| `1k` | 标准画质 | 10 积分/张 |
| `2k` | 高清 | 20 积分/张 |
| `4k` | 超高清 | 40 积分/张 |

> 注意：`resolution` 对 wuai 有效。Google 原生格式用的是 `imageSize`，代码会自动转换，不需要你手动处理。

---

## 四、文件地图（一张图看清整体）

```
.env.local                      ← 供应商账号密码（换供应商改这里）
    ↓
lib/config/image.ts             ← 图片默认参数（改画质/比例改这里）
    ↓
lib/services/generation-pipeline.ts   ← 生成流程（不需要动）
    ↓
lib/llm/image-provider.ts       ← 各供应商的接口适配层（不需要动）
    ↓
图片生成 API
```

---

## 五、快速检查清单

换供应商前，确认以下几项：

- [ ] `.env.local` 里的 `IMAGE_BASE_URL` 已更新
- [ ] `.env.local` 里的 `IMAGE_API_KEY` 已更新为新供应商的密钥
- [ ] `.env.local` 里的 `IMAGE_API_FORMAT` 与新供应商匹配
- [ ] 如果是 wuai，`IMAGE_MODEL` 这行已删除或注释掉
- [ ] 本地重启开发服务器（`npm run dev`）使 `.env.local` 生效

---

*最后更新：2026-04-01*
