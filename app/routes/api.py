#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import jsonify, request
from app import app
from app.services.container_service import (
    get_all_containers, 
    get_container_stats, 
    start_container, 
    stop_container, 
    restart_container, 
    get_container_logs
)
from app.docker_client import get_docker_client
import logging

logger = logging.getLogger(__name__)

# 获取所有容器
@app.route('/api/containers/all')
def api_get_all_containers():
    try:
        containers = get_all_containers()
        return jsonify({"success": True, "containers": containers})
    except ConnectionError as e:
        return jsonify({"success": False, "error": str(e)}), 500
    except Exception as e:
        logger.error(f"获取容器列表失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# 获取容器资源统计
@app.route('/api/containers/stats')
def api_get_container_stats():
    try:
        stats = get_container_stats()
        return jsonify({"success": True, "stats": stats})
    except ConnectionError as e:
        return jsonify({"success": False, "error": str(e)}), 500
    except Exception as e:
        logger.error(f"获取容器统计信息失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# 启动容器
@app.route('/api/start/<container_id>')
def api_start_container(container_id):
    try:
        start_container(container_id)
        return jsonify({"success": True})
    except ConnectionError as e:
        return jsonify({"success": False, "error": str(e)}), 500
    except Exception as e:
        logger.error(f"启动容器失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# 停止容器
@app.route('/api/stop/<container_id>')
def api_stop_container(container_id):
    try:
        stop_container(container_id)
        return jsonify({"success": True})
    except ConnectionError as e:
        return jsonify({"success": False, "error": str(e)}), 500
    except Exception as e:
        logger.error(f"停止容器失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# 重启容器
@app.route('/api/restart/<container_id>')
def api_restart_container(container_id):
    try:
        restart_container(container_id)
        return jsonify({"success": True})
    except ConnectionError as e:
        return jsonify({"success": False, "error": str(e)}), 500
    except Exception as e:
        logger.error(f"重启容器失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# 获取容器日志
@app.route('/api/logs/<container_id>')
def api_get_container_logs(container_id):
    try:
        logs = get_container_logs(container_id)
        return logs
    except ConnectionError as e:
        return f"Docker连接失败: {str(e)}", 500
    except Exception as e:
        logger.error(f"获取容器日志失败: {e}")
        return f"获取日志失败: {str(e)}", 500

# 在容器中执行命令
@app.route('/api/exec/<container_id>', methods=['POST'])
def api_exec_command(container_id):
    try:
        data = request.json
        command = data.get('command')
        
        if not command:
            return jsonify({"success": False, "error": "缺少命令参数"}), 400
        
        client = get_docker_client()
        if not client:
            return jsonify({"success": False, "error": "Docker连接失败"}), 500
        
        container = client.containers.get(container_id)
        # 禁用TTY模式以避免ANSI转义序列
        result = container.exec_run(command, tty=False)
        
        return jsonify({
            "success": True,
            "exit_code": result.exit_code,
            "output": result.output.decode('utf-8', errors='replace')
        })
    except Exception as e:
        logger.error(f"执行命令失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
