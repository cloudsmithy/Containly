#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import docker
import logging

logger = logging.getLogger(__name__)

# 尝试连接Docker
try:
    client = docker.from_env()
    logger.info("成功连接到Docker")
except Exception as e:
    logger.error(f"连接Docker失败: {e}")
    client = None

def get_docker_client():
    """获取Docker客户端实例"""
    return client

def is_connected():
    """检查Docker连接状态"""
    return client is not None
