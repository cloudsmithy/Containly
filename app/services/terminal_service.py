#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import logging
import threading
import time
from app.docker_client import get_docker_client

logger = logging.getLogger(__name__)

_sessions_lock = threading.Lock()
active_sessions = {}


def create_exec_instance(container_id, socketio, sid, command="/bin/sh"):
    """创建交互式 shell 并启动后台输出读取线程"""
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

    session = {
        "socket": exec_stream,
        "container_id": container_id,
        "sid": sid,
        "last_activity": time.time(),
        "active": True
    }

    with _sessions_lock:
        active_sessions[exec_id["Id"]] = session

    # 启动后台线程持续读取输出并推送给前端
    t = threading.Thread(
        target=_read_output_loop,
        args=(exec_id["Id"], session, socketio),
        daemon=True
    )
    t.start()

    return exec_id["Id"]


def _read_output_loop(exec_id, session, socketio):
    """后台线程：持续读取 shell 输出，通过 WebSocket 推送给前端"""
    sock = session["socket"]
    sid = session["sid"]

    try:
        while session["active"]:
            try:
                sock._sock.settimeout(0.5)
                chunk = sock._sock.recv(4096)
                if not chunk:
                    break
                text = chunk.decode('utf-8', errors='replace')
                socketio.emit('terminal_output', {'output': text}, to=sid)
            except (TimeoutError, OSError):
                # 超时只是没数据，继续循环
                continue
    except Exception as e:
        logger.error(f"输出读取线程异常: {e}")
    finally:
        socketio.emit('terminal_output', {'output': '\r\n[会话已结束]\r\n'}, to=sid)


def send_input(exec_id, data):
    """向 shell 发送原始输入（不再读取响应，由后台线程推送）"""
    with _sessions_lock:
        session = active_sessions.get(exec_id)
    if not session:
        raise ValueError(f"终端会话 {exec_id} 不存在")

    session["last_activity"] = time.time()
    session["socket"]._sock.send(data.encode('utf-8'))


def resize_exec_instance(exec_id, height, width):
    """调整终端大小"""
    client = get_docker_client()
    if not client:
        raise ConnectionError("Docker连接失败")
    client.api.exec_resize(exec_id, height=height, width=width)


def close_session(exec_id):
    """关闭终端会话"""
    with _sessions_lock:
        session = active_sessions.pop(exec_id, None)
    if session:
        session["active"] = False
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
        close_session(exec_id)
        logger.info(f"已清理不活跃会话: {exec_id}")


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
