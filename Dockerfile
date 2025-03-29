# 多阶段构建
FROM python:3.12-slim AS builder

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 最终镜像
FROM python:3.12-slim

WORKDIR /app

# 创建非 root 用户
RUN adduser --disabled-password --gecos '' appuser

# 复制依赖
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# 复制应用代码
COPY . .
RUN chmod +x start.sh

# 设置权限
RUN chown -R appuser:appuser /app
USER appuser

# 设置环境变量
ENV FLASK_ENV=production
ENV PORT=5000
ENV REFRESH_INTERVAL=30
ENV LOG_LINES=100

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/ || exit 1

# 暴露端口
EXPOSE 5000

# 启动应用
CMD ["./start.sh"]
