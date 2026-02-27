#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import docker
import logging

logger = logging.getLogger(__name__)

client = None

try:
    client = docker.from_env()
    logger.info("成功连接到Docker")
except Exception as e:
    logger.error(f"连接Docker失败: {e}")

def get_docker_client():
    """获取Docker客户端实例，支持自动重连"""
    global client
    if client is None:
        try:
            client = docker.from_env()
            logger.info("重新连接Docker成功")
        except Exception as e:
            logger.error(f"重连Docker失败: {e}")
    return client

def is_connected():
    """检查Docker连接状态"""
    return get_docker_client() is not None
