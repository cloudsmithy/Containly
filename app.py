#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import Flask, render_template, jsonify, request, send_from_directory
import docker
import os
import json
import time
import logging
from datetime import datetime

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# 尝试连接Docker
try:
    client = docker.from_env()
    logger.info("成功连接到Docker")
except Exception as e:
    logger.error(f"连接Docker失败: {e}")
    client = None

# 主页
@app.route('/')
def index():
    return render_template('index.html')

# 黑名单页面
@app.route('/blacklist')
def blacklist():
    return render_template('blacklist.html')

# 终端页面
@app.route('/terminal/<container_id>')
def terminal(container_id):
    return render_template('terminal.html', container_id=container_id)

# 获取所有容器
@app.route('/api/containers/all')
def get_all_containers():
    if not client:
        return jsonify({"success": False, "error": "Docker连接失败"}), 500
    
    try:
        # 获取所有容器
        containers = client.containers.list(all=True)
        
        # 按状态分组
        grouped = {
            "running": [],
            "exited": [],
            "paused": [],
            "other": []
        }
        
        for container in containers:
            container_info = {
                "id": container.id,
                "name": container.name,
                "status": container.status,
                "image": container.image.tags[0] if container.image.tags else "无标签",
                "created": container.attrs["Created"],
                "ports": [],
                "network": "bridge",
                "cpu_usage": 0,
                "memory_usage": 0
            }
            
            # 获取端口映射
            if container.attrs.get("NetworkSettings", {}).get("Ports"):
                for container_port, host_ports in container.attrs["NetworkSettings"]["Ports"].items():
                    if host_ports:
                        for mapping in host_ports:
                            container_info["ports"].append({
                                "container_port": container_port.split("/")[0],
                                "host_port": mapping["HostPort"]
                            })
            
            # 获取网络模式
            if container.attrs.get("HostConfig", {}).get("NetworkMode"):
                container_info["network"] = container.attrs["HostConfig"]["NetworkMode"]
            
            # 按状态分组
            if container.status == "running":
                grouped["running"].append(container_info)
            elif container.status == "exited":
                grouped["exited"].append(container_info)
            elif container.status == "paused":
                grouped["paused"].append(container_info)
            else:
                grouped["other"].append(container_info)
        
        return jsonify({"success": True, "containers": grouped})
    
    except Exception as e:
        logger.error(f"获取容器列表失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# 获取容器资源统计
@app.route('/api/containers/stats')
def get_container_stats():
    if not client:
        return jsonify({"success": False, "error": "Docker连接失败"}), 500
    
    try:
        # 获取所有运行中的容器
        containers = client.containers.list()
        stats = {}
        
        for container in containers:
            try:
                # 获取容器统计信息
                container_stats = container.stats(stream=False)
                
                # 计算CPU使用率
                cpu_delta = container_stats["cpu_stats"]["cpu_usage"]["total_usage"] - \
                            container_stats["precpu_stats"]["cpu_usage"]["total_usage"]
                system_delta = container_stats["cpu_stats"]["system_cpu_usage"] - \
                               container_stats["precpu_stats"]["system_cpu_usage"]
                
                if system_delta > 0 and cpu_delta > 0:
                    cpu_usage = (cpu_delta / system_delta) * 100.0
                else:
                    cpu_usage = 0
                
                # 计算内存使用率
                memory_usage = container_stats["memory_stats"].get("usage", 0)
                memory_limit = container_stats["memory_stats"].get("limit", 1)
                memory_percent = (memory_usage / memory_limit) * 100.0
                
                stats[container.id] = {
                    "cpu_usage": round(cpu_usage, 2),
                    "memory_usage": round(memory_percent, 2)
                }
            except Exception as e:
                logger.error(f"获取容器 {container.name} 统计信息失败: {e}")
                stats[container.id] = {
                    "cpu_usage": 0,
                    "memory_usage": 0
                }
        
        return jsonify({"success": True, "stats": stats})
    
    except Exception as e:
        logger.error(f"获取容器统计信息失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# 启动容器
@app.route('/api/start/<container_id>')
def start_container(container_id):
    if not client:
        return jsonify({"success": False, "error": "Docker连接失败"}), 500
    
    try:
        container = client.containers.get(container_id)
        container.start()
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"启动容器失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# 停止容器
@app.route('/api/stop/<container_id>')
def stop_container(container_id):
    if not client:
        return jsonify({"success": False, "error": "Docker连接失败"}), 500
    
    try:
        container = client.containers.get(container_id)
        container.stop()
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"停止容器失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# 重启容器
@app.route('/api/restart/<container_id>')
def restart_container(container_id):
    if not client:
        return jsonify({"success": False, "error": "Docker连接失败"}), 500
    
    try:
        container = client.containers.get(container_id)
        container.restart()
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"重启容器失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# 获取容器日志
@app.route('/api/logs/<container_id>')
def get_container_logs(container_id):
    if not client:
        return "Docker连接失败", 500
    
    try:
        container = client.containers.get(container_id)
        logs = container.logs(tail=500).decode('utf-8', errors='replace')
        return logs
    except Exception as e:
        logger.error(f"获取容器日志失败: {e}")
        return f"获取日志失败: {str(e)}", 500

# 主程序入口
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
