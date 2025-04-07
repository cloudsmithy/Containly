#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import docker
import logging
import threading
import time
from app.docker_client import get_docker_client

logger = logging.getLogger(__name__)

# 存储活跃的终端会话
active_sessions = {}

def create_exec_instance(container_id, command="/bin/sh"):
    """在容器中创建一个执行实例"""
    client = get_docker_client()
    if not client:
        raise ConnectionError("Docker连接失败")
    
    try:
        container = client.containers.get(container_id)
        exec_id = client.api.exec_create(
            container.id,
            command,
            stdin=True,
            stdout=True,
            stderr=True,
            tty=True
        )
        
        # 启动执行实例
        exec_stream = client.api.exec_start(
            exec_id["Id"],
            detach=False,
            tty=True,
            stream=True,
            socket=True
        )
        
        # 存储会话信息
        active_sessions[exec_id["Id"]] = {
            "socket": exec_stream,
            "container_id": container_id,
            "last_activity": time.time()
        }
        
        return exec_id["Id"]
    except Exception as e:
        logger.error(f"创建执行实例失败: {e}")
        raise

def resize_exec_instance(exec_id, height, width):
    """调整终端大小"""
    client = get_docker_client()
    if not client:
        raise ConnectionError("Docker连接失败")
    
    try:
        client.api.exec_resize(exec_id, height=height, width=width)
        return True
    except Exception as e:
        logger.error(f"调整终端大小失败: {e}")
        raise

def send_command(exec_id, command):
    """向终端发送命令"""
    if exec_id not in active_sessions:
        raise ValueError(f"终端会话 {exec_id} 不存在")
    
    try:
        session = active_sessions[exec_id]
        socket = session["socket"]
        
        # 更新最后活动时间
        session["last_activity"] = time.time()
        
        # 发送命令
        socket._sock.send(command.encode('utf-8'))
        
        # 等待一小段时间以确保命令被处理
        time.sleep(0.05)
        
        # 读取响应
        response = b''
        
        # 设置超时时间
        socket._sock.settimeout(0.5)
        
        try:
            while True:
                try:
                    chunk = socket._sock.recv(4096)
                    if not chunk:
                        break
                    response += chunk
                except socket.timeout:
                    break
        except Exception as e:
            logger.warning(f"读取响应时出现异常: {e}")
        
        # 恢复默认超时
        socket._sock.settimeout(None)
        
        return response.decode('utf-8', errors='replace')
    except Exception as e:
        logger.error(f"发送命令失败: {e}")
        raise

def cleanup_inactive_sessions():
    """清理不活跃的会话"""
    current_time = time.time()
    inactive_sessions = []
    
    for exec_id, session in active_sessions.items():
        if current_time - session["last_activity"] > 3600:  # 1小时不活跃
            inactive_sessions.append(exec_id)
    
    for exec_id in inactive_sessions:
        try:
            session = active_sessions.pop(exec_id)
            session["socket"]._sock.close()
            logger.info(f"已清理不活跃会话: {exec_id}")
        except Exception as e:
            logger.error(f"清理会话失败: {e}")

# 启动定期清理任务
def start_cleanup_task():
    def cleanup_task():
        while True:
            try:
                cleanup_inactive_sessions()
            except Exception as e:
                logger.error(f"清理任务出错: {e}")
            time.sleep(1800)  # 每30分钟运行一次
    
    cleanup_thread = threading.Thread(target=cleanup_task, daemon=True)
    cleanup_thread.start()

# 应用启动时启动清理任务
start_cleanup_task()
