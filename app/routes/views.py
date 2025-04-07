#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import render_template
from app import app
from app.docker_client import get_docker_client
import logging

logger = logging.getLogger(__name__)

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
    # 获取容器名称
    try:
        client = get_docker_client()
        if client:
            container = client.containers.get(container_id)
            container_name = container.name
        else:
            container_name = "未知容器"
    except Exception as e:
        logger.error(f"获取容器信息失败: {e}")
        container_name = "未知容器"
    
    return render_template('terminal.html', container_id=container_id, container_name=container_name)
