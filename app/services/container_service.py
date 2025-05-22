#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import logging
from app.docker_client import get_docker_client

logger = logging.getLogger(__name__)

def get_all_images():
    """
    获取所有Docker镜像
    
    Returns:
        list: 镜像信息列表
    """
    client = get_docker_client()
    if not client:
        raise ConnectionError("Docker连接失败")
    
    try:
        # 获取所有镜像
        images = client.images.list()
        image_list = []
        
        for image in images:
            image_info = {
                "id": image.id,
                "short_id": image.short_id,
                "tags": image.tags if image.tags else ["<none>:<none>"],
                "size": round(image.attrs["Size"] / (1024 * 1024), 2),  # 转换为MB
                "created": image.attrs["Created"],
                "containers": []  # 使用此镜像的容器列表
            }
            image_list.append(image_info)
        
        # 获取所有容器，并关联到对应的镜像
        containers = client.containers.list(all=True)
        for container in containers:
            image_id = container.image.id
            for image in image_list:
                if image["id"] == image_id:
                    image["containers"].append({
                        "id": container.id,
                        "name": container.name,
                        "status": container.status
                    })
        
        return image_list
    
    except Exception as e:
        logger.error(f"获取镜像列表失败: {e}")
        raise

def delete_container(container_id, force=False):
    """删除容器"""
    client = get_docker_client()
    if not client:
        raise ConnectionError("Docker连接失败")
    
    try:
        container = client.containers.get(container_id)
        container.remove(force=force)
        return True
    except Exception as e:
        logger.error(f"删除容器失败: {e}")
        raise

def delete_image(image_id, force=False):
    """删除镜像"""
    client = get_docker_client()
    if not client:
        raise ConnectionError("Docker连接失败")
    
    try:
        client.images.remove(image_id, force=force)
        return True
    except Exception as e:
        logger.error(f"删除镜像失败: {e}")
        raise

def get_all_containers():
    """
    获取所有容器并按状态分组
    
    Returns:
        dict: 按状态分组的容器信息
    """
    client = get_docker_client()
    if not client:
        raise ConnectionError("Docker连接失败")
    
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
                "image_id": container.image.id,
                "created": container.attrs["Created"],
                "ports": [],
                "network": "bridge",
                "cpu_usage": 0,
                "memory_usage": 0
            }
            
            # 获取端口映射
            if container.attrs.get("NetworkSettings", {}).get("Ports"):
                # 使用集合去重
                unique_ports = set()
                for container_port, host_ports in container.attrs["NetworkSettings"]["Ports"].items():
                    if host_ports:
                        for mapping in host_ports:
                            # 创建唯一标识
                            port_key = f"{container_port.split('/')[0]}-{mapping['HostPort']}"
                            if port_key not in unique_ports:
                                unique_ports.add(port_key)
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
        
        return grouped
    
    except Exception as e:
        logger.error(f"获取容器列表失败: {e}")
        raise

def get_container_stats():
    """
    获取所有运行中容器的资源统计信息
    
    Returns:
        dict: 容器ID到资源统计的映射
    """
    client = get_docker_client()
    if not client:
        raise ConnectionError("Docker连接失败")
    
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
        
        return stats
    
    except Exception as e:
        logger.error(f"获取容器统计信息失败: {e}")
        raise

def start_container(container_id):
    """启动容器"""
    client = get_docker_client()
    if not client:
        raise ConnectionError("Docker连接失败")
    
    try:
        container = client.containers.get(container_id)
        container.start()
        return True
    except Exception as e:
        logger.error(f"启动容器失败: {e}")
        raise

def stop_container(container_id):
    """停止容器"""
    client = get_docker_client()
    if not client:
        raise ConnectionError("Docker连接失败")
    
    try:
        container = client.containers.get(container_id)
        container.stop()
        return True
    except Exception as e:
        logger.error(f"停止容器失败: {e}")
        raise

def restart_container(container_id):
    """重启容器"""
    client = get_docker_client()
    if not client:
        raise ConnectionError("Docker连接失败")
    
    try:
        container = client.containers.get(container_id)
        container.restart()
        return True
    except Exception as e:
        logger.error(f"重启容器失败: {e}")
        raise

def get_container_logs(container_id, tail=500):
    """获取容器日志"""
    client = get_docker_client()
    if not client:
        raise ConnectionError("Docker连接失败")
    
    try:
        container = client.containers.get(container_id)
        logs = container.logs(tail=tail).decode('utf-8', errors='replace')
        return logs
    except Exception as e:
        logger.error(f"获取容器日志失败: {e}")
        raise
