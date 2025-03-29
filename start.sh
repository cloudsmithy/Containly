#!/bin/bash

# 启动 Containly 应用
# 可以通过环境变量自定义配置

# 设置默认值
export PORT=${PORT:-5001}
export FLASK_DEBUG=${FLASK_DEBUG:-false}
export REFRESH_INTERVAL=${REFRESH_INTERVAL:-30}
export LOG_LINES=${LOG_LINES:-100}

# 启动应用
echo "启动 Containly 应用..."
echo "端口: $PORT"
echo "调试模式: $FLASK_DEBUG"
echo "刷新间隔: $REFRESH_INTERVAL 秒"
echo "日志行数: $LOG_LINES"

python app.py
