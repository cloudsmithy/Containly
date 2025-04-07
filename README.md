# 🌈 Containly

**Containly** 是由 [Cloudsmithy](https://github.com/cloudsmithy) 打造的一款轻盈优雅的 Docker 容器仪表盘，提供直观的界面和实用功能，帮助你高效管理宿主机上的容器状态与端口访问。

> ✨ 支持浏览器访问 / 多状态分组 / 自动刷新 / 在线检测 / 暗黑模式 / 一键部署

---

## 🚀 快速开始（Docker 推荐部署方式）

### 方式一：直接使用 Docker Hub 镜像

```bash
docker run -d \
  --name containly \
  -p 5001:5001 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  cloudsmithy/containly
```

访问：

```
http://localhost:5001
```

### 方式二：使用 Docker Compose（推荐开发/可维护）

```yaml
version: "3.8"
services:
  containly:
    image: cloudsmithy/containly
    ports:
      - "5001:5001"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    restart: unless-stopped
```

启动：

```bash
docker-compose up -d
```

---

## ✨ 功能亮点

- 🔍 **容器状态分类显示**（Running / Paused / Exited / Other）
- 🌐 **主机端口跳转**，自动生成 http://IP:Port 访问链接
- 🧪 **在线检测端口状态**（实时可达/不可达提示）
- 🌗 **夜间模式一键切换**
- 📋 **端口号点击复制**
- 🔄 **每 30 秒自动刷新状态**
- 🎨 **现代渐变风 UI + 多彩卡片分组**

---

## 🖥 页面截图（可替换）

> ![Containly Screenshot](https://your-screenshot-url.com/demo.png)

---

## 🛠 本地开发

```bash
git clone https://github.com/cloudsmithy/containly.git
cd containly
pip install -r requirements.txt
python run.py
```

---

## 📁 文件结构

```
containly/
├── app/                   # 应用主目录
│   ├── __init__.py        # 应用初始化
│   ├── docker_client.py   # Docker客户端连接
│   ├── routes/            # 路由模块
│   │   ├── __init__.py
│   │   ├── views.py       # 页面路由
│   │   └── api.py         # API路由
│   └── services/          # 服务模块
│       ├── __init__.py
│       └── container_service.py  # 容器服务
├── static/                # 静态文件目录
│   ├── css/
│   │   ├── style.css      # 主样式
│   │   └── colors.css     # 颜色样式
│   └── js/
│       └── main.js        # JavaScript代码
├── templates/             # 模板目录
│   ├── index.html         # 主页模板
│   ├── error.html         # 错误页面
│   └── blacklist.html     # 黑名单管理页面
├── run.py                 # 应用入口
├── requirements.txt       # 依赖列表
├── Dockerfile             # 容器构建定义
├── docker-compose.yml     # Compose部署配置
└── README.md
```

---

## 📦 镜像地址

> Docker Hub: [cloudsmithy/containly](https://hub.docker.com/r/cloudsmithy/containly)

---

## 📝 许可证 License

MIT License - 自由使用、修改与部署，致谢请保留原始作者。

---

> Made with ❤️ by [cloudsmithy](https://github.com/cloudsmithy)
