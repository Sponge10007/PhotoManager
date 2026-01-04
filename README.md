# PhotoMS - 图片管理系统

基于 B/S 架构的图片管理平台，支持图片上传、EXIF 解析、AI 标签和智能检索。

## 技术栈

### 前端
- React 19 + TypeScript
- Vite
- Tailwind CSS + Shadcn/UI
- Zustand (状态管理)
- TanStack Query (数据请求)
- React Router (路由)

### 后端
- Go (Golang) 1.24+
- Gin (Web 框架)
- MongoDB 6.0+ (数据库)
- JWT (认证)
- Bcrypt (密码加密)

## 项目结构

```
BS/
├── client/                 # 前端项目
│   ├── src/
│   │   ├── api/           # API 请求
│   │   ├── components/    # 组件
│   │   ├── hooks/         # 自定义 Hooks
│   │   ├── lib/           # 工具库
│   │   ├── pages/         # 页面
│   │   ├── store/         # 状态管理
│   │   ├── types/         # 类型定义
│   │   └── utils/         # 工具函数
│   └── package.json
├── server/                # 后端项目
│   ├── cmd/server/        # 入口文件
│   ├── internal/
│   │   ├── controller/    # 控制器层
│   │   ├── service/       # 服务层
│   │   ├── repository/    # 数据访问层
│   │   ├── middleware/    # 中间件
│   │   └── models/        # 数据模型
│   ├── pkg/
│   │   ├── config/        # 配置
│   │   └── utils/         # 工具函数
│   └── go.mod
└── docker-compose.yml     # Docker 编排

```

## 快速开始

### 开发环境

#### 1. 启动 MongoDB (使用 Docker)
```bash
docker-compose up -d mongodb
```

#### 2. 启动后端
```bash
cd server
cp .env.example .env
go mod tidy
go run cmd/server/main.go
```

后端将在 `http://localhost:8080` 运行

#### 3. 启动前端
```bash
cd client
npm install
npm run dev
```

前端将在 `http://localhost:5173` 运行

### 生产环境 (Docker)

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## API 接口

### 认证接口
- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录

### 图片接口 (需要认证)
- `POST /api/v1/photos` - 上传图片
- `GET /api/v1/photos` - 获取图片列表（支持 `page/limit/q/tag/startDate/endDate` 查询参数）
- `GET /api/v1/photos/:id` - 获取图片详情
- `PUT /api/v1/photos/:id` - 更新图片信息
- `DELETE /api/v1/photos/:id` - 删除图片
- `POST /api/v1/photos/:id/ai-tags` - 生成/刷新 AI 标签（可选功能，需要开启 `AI_TAGGING_ENABLED` 并配置 `ARK_API_KEY`）

## 功能特性

### 已实现
- ✅ 用户注册/登录 + JWT 认证
- ✅ 图片上传与存储（含缩略图生成、EXIF 解析）
- ✅ AI 视觉标签（可选：接入火山方舟 Doubao 视觉模型，生成如风景/人物/动物等标签）
- ✅ 图片秒传/去重（基于 Hash 复用文件，删除时安全引用计数）
- ✅ 图片列表分页 + 搜索/过滤（`q/tag/startDate/endDate`）
- ✅ 图片详情编辑（标题/描述/标签）与下载
- ✅ MCP 对话检索（提供 MCP Server：`search_photos` / `get_photo`）

### 待实现
- ⏳ 更丰富的图片编辑（裁剪/旋转等）
- ⏳ 向量检索等高级检索

## 开发说明

### 环境要求
- Node.js 20+
- Go 1.24+
- MongoDB 6.0+
- Docker & Docker Compose (可选)

### 前端开发
```bash
cd client
npm run dev      # 开发服务器
npm run build    # 生产构建
npm run preview  # 预览生产构建
```

### 后端开发
```bash
cd server
go run cmd/server/main.go  # 运行服务器
go test ./...              # 运行测试
go build -o bin/server cmd/server/main.go  # 构建可执行文件
```

### MCP 对话检索 (Model Context Protocol)

本项目提供一个 MCP Server（stdio），让支持 MCP 的大模型客户端通过对话检索 PhotoMS 图片库。

```bash
cd server
go run cmd/mcp/main.go
```

可选环境变量：
- `MCP_BASE_URL`：生成图片 URL 的网站地址（默认 `http://localhost:8080`）
- `MCP_USER_ID`：可选，限制检索某个用户的图片（MongoDB ObjectID hex）

## 许可证

本项目为课程作业项目。
