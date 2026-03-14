# YouTube Transcript App

一个现代化的 YouTube 字幕获取工具，使用 Next.js 和 TypeScript 构建。

## 功能特性

- 🎯 支持 YouTube URL 和视频 ID
- 🌍 多语言字幕支持
- 📋 一键复制字幕
- 🎨 深色模式支持
- ⚡ 快速响应，无需额外后端服务
- 📱 响应式设计

## 技术栈

- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **API**: youtube-transcript (Node.js)

## 项目结构

```
transcript-app/
├── app/                          # Next.js App Router
│   ├── api/transcript/          # 字幕 API 路由
│   ├── error.tsx                # 错误边界
│   ├── layout.tsx               # 根布局
│   ├── not-found.tsx            # 404 页面
│   └── page.tsx                 # 主页
├── components/
│   └── ui/                      # UI 组件
│       ├── loading-skeleton.tsx # 加载骨架屏
│       └── transcript-list.tsx  # 字幕列表
├── lib/
│   ├── api/                     # API 相关
│   │   └── errors.ts            # 错误处理
│   ├── types/                   # 类型定义
│   │   └── transcript.ts        # 字幕类型
│   └── utils/                   # 工具函数
│       ├── extract-video-id.ts  # 视频 ID 提取
│       └── format-time.ts       # 时间格式化
└── public/                      # 静态资源
```

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

访问 http://localhost:3000

## 使用方法

1. 输入 YouTube 视频链接或视频 ID
2. （可选）指定语言代码（如 en, zh-Hans, zh-Hant）
3. 点击"获取字幕"
4. 查看或复制字幕内容

## 部署

推荐部署到 Vercel：

```bash
npm install -g vercel
vercel
```

## Learn More

To learn more about Next.js:

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)

## License

MIT

