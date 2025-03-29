#!/bin/bash
# start.sh

# 默认使用 4 个 Gunicorn worker
WORKERS=${WORKERS:-4}

echo "🚀 Starting Containly with $WORKERS workers..."
echo "📊 Port: $PORT"
echo "🔄 Refresh interval: ${REFRESH_INTERVAL}s"

# 启动 Flask 应用
exec gunicorn -w "$WORKERS" -b 0.0.0.0:$PORT app:app
