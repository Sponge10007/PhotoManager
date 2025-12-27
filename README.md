# PhotoMS - 图片管理系统

基于 B/S 架构的图片管理平台，支持图片上传、EXIF 解析、AI 标签和智能检索。

## 技术栈

### 前端
- React 18 + TypeScript
- Vite
- Tailwind CSS + Shadcn/UI
- Zustand (状态管理)
- TanStack Query (数据请求)
- React Router (路由)

### 后端
- Go (Golang) 1.21+
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
- `GET /api/v1/photos` - 获取图片列表
- `GET /api/v1/photos/:id` - 获取图片详情
- `PUT /api/v1/photos/:id` - 更新图片信息
- `DELETE /api/v1/photos/:id` - 删除图片

## 功能特性

### 已实现
- ✅ 用户注册/登录
- ✅ JWT 认证
- ✅ 基础路由和页面框架
- ✅ MongoDB 连接
- ✅ 三层架构 (Controller-Service-Repository)

### 待实现
- ⏳ 图片上传与存储
- ⏳ EXIF 信息解析
- ⏳ 缩略图生成
- ⏳ 图片秒传（基于 Hash）
- ⏳ AI 标签分析
- ⏳ 高级搜索和过滤
- ⏳ 图片编辑功能
- ⏳ MCP 智能检索

## 开发说明

### 环境要求
- Node.js 20+
- Go 1.21+
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

## 许可证

本项目为课程作业项目。
