#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import request
from flask_socketio import emit, join_room
from app import socketio
from app.services.terminal_service import (
    create_exec_instance, resize_exec_instance, send_command, close_session
)
import logging

logger = logging.getLogger(__name__)

# 跟踪 WebSocket sid -> exec_id 的映射
_sid_to_exec = {}


@socketio.on('connect')
def handle_connect():
    logger.info("客户端连接")
    emit('connection_established', {'status': 'connected'})


@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    exec_id = _sid_to_exec.pop(sid, None)
    if exec_id:
        try:
            close_session(exec_id)
            logger.info(f"客户端断开，已清理终端会话: {exec_id}")
        except Exception as e:
            logger.error(f"断连清理会话失败: {e}")
    else:
        logger.info("客户端断开连接")


@socketio.on('terminal_init')
def handle_terminal_init(data):
    """初始化终端会话"""
    container_id = data.get('container_id')
    if not container_id:
        emit('terminal_error', {'error': '缺少容器ID'})
        return

    try:
        exec_id = create_exec_instance(container_id)
        logger.info(f"为容器 {container_id} 创建终端会话: {exec_id}")

        # 记录 sid -> exec_id 映射
        _sid_to_exec[request.sid] = exec_id

        join_room(exec_id)
        emit('terminal_ready', {'exec_id': exec_id})

        initial_output = send_command(exec_id, "\n")
        emit('terminal_output', {'output': initial_output})
    except Exception as e:
        logger.error(f"初始化终端失败: {e}")
        emit('terminal_error', {'error': str(e)})


@socketio.on('terminal_input')
def handle_terminal_input(data):
    """处理终端输入"""
    exec_id = data.get('exec_id')
    command = data.get('command')

    if not exec_id or command is None:
        emit('terminal_error', {'error': '缺少必要参数'})
        return

    try:
        response = send_command(exec_id, command)
        emit('terminal_output', {'output': response})
    except Exception as e:
        logger.error(f"处理终端输入失败: {e}")
        emit('terminal_error', {'error': str(e)})


@socketio.on('terminal_resize')
def handle_terminal_resize(data):
    """调整终端大小"""
    exec_id = data.get('exec_id')
    height = data.get('height')
    width = data.get('width')

    if not exec_id or not height or not width:
        emit('terminal_error', {'error': '缺少必要参数'})
        return

    try:
        resize_exec_instance(exec_id, height, width)
        emit('terminal_resized', {'success': True})
    except Exception as e:
        logger.error(f"调整终端大小失败: {e}")
        emit('terminal_error', {'error': str(e)})
