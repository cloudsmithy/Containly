#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import logging
import threading
import time
from app.docker_client import get_docker_client

logger = logging.getLogger(__name__)

# 存储活跃的终端会话（线程安全）
_sessions_lock = threading.Lock()
active_sessions = {}


def create_exec_instance(container_id, command="/bin/sh"):
    """在容器中创建一个执行实例"""
    client = get_docker_client()
    if not client:
        raise ConnectionError("Docker连接失败")

    container = client.containers.get(container_id)
    exec_id = client.api.exec_create(
        container.id, command,
        stdin=True, stdout=True, stderr=True, tty=True
    )

    exec_stream = client.api.exec_start(
        exec_id["Id"], detach=False, tty=True, stream=True, socket=True
    )

    with _sessions_lock:
        active_sessions[exec_id["Id"]] = {
            "socket": exec_stream,
            "container_id": container_id,
            "last_activity": time.time()
        }

    return exec_id["Id"]


def resize_exec_instance(exec_id, height, width):
    """调整终端大小"""
    client = get_docker_client()
    if not client:
        raise ConnectionError("Docker连接失败")
    client.api.exec_resize(exec_id, height=height, width=width)
    return True


def send_command(exec_id, command):
    """向终端发送命令"""
    with _sessions_lock:
        session = active_sessions.get(exec_id)
    if not session:
        raise ValueError(f"终端会话 {exec_id} 不存在")

    sock = session["socket"]
    session["last_activity"] = time.time()

    # 发送命令
    sock._sock.send(command.encode('utf-8'))
    time.sleep(0.05)

    # 读取响应
    response = b''
    sock._sock.settimeout(0.5)

    try:
        while True:
            chunk = sock._sock.recv(4096)
            if not chunk:
                break
            response += chunk
    except (TimeoutError, OSError):
        pass

    sock._sock.settimeout(None)
    return response.decode('utf-8', errors='replace')


def close_session(exec_id):
    """主动关闭一个终端会话"""
    with _sessions_lock:
        session = active_sessions.pop(exec_id, None)
    if session:
        try:
            session["socket"]._sock.close()
        except Exception as e:
            logger.error(f"关闭会话 socket 失败: {e}")


def cleanup_inactive_sessions():
    """清理不活跃的会话"""
    current_time = time.time()
    with _sessions_lock:
        inactive = [eid for eid, s in active_sessions.items()
                    if current_time - s["last_activity"] > 3600]

    for exec_id in inactive:
        try:
            with _sessions_lock:
                session = active_sessions.pop(exec_id, None)
            if session:
                session["socket"]._sock.close()
                logger.info(f"已清理不活跃会话: {exec_id}")
        except Exception as e:
            logger.error(f"清理会话失败: {e}")


def start_cleanup_task():
    def cleanup_task():
        while True:
            try:
                cleanup_inactive_sessions()
            except Exception as e:
                logger.error(f"清理任务出错: {e}")
            time.sleep(1800)

    threading.Thread(target=cleanup_task, daemon=True).start()


start_cleanup_task()
