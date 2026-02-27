#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import logging
from concurrent.futures import ThreadPoolExecutor
from app.docker_client import get_docker_client

logger = logging.getLogger(__name__)


def _require_client():
    client = get_docker_client()
    if not client:
        raise ConnectionError("Docker连接失败")
    return client


def get_all_images():
    """获取所有Docker镜像"""
    client = _require_client()

    images = client.images.list()
    image_list = []

    for image in images:
        image_list.append({
            "id": image.id,
            "short_id": image.short_id,
            "tags": image.tags if image.tags else ["<none>:<none>"],
            "size": round(image.attrs["Size"] / (1024 * 1024), 2),
            "created": image.attrs["Created"],
            "containers": []
        })

    # 用字典索引替代嵌套循环
    image_map = {img["id"]: img for img in image_list}
    for container in client.containers.list(all=True):
        img = image_map.get(container.image.id)
        if img:
            img["containers"].append({
                "id": container.id,
                "name": container.name,
                "status": container.status
            })

    return image_list


def delete_container(container_id, force=False):
    """删除容器"""
    client = _require_client()
    client.containers.get(container_id).remove(force=force)
    return True


def delete_image(image_id, force=False):
    """删除镜像"""
    client = _require_client()
    client.images.remove(image_id, force=force)
    return True


def get_all_containers():
    """获取所有容器并按状态分组"""
    client = _require_client()

    containers = client.containers.list(all=True)

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
        ports = container.attrs.get("NetworkSettings", {}).get("Ports")
        if ports:
            unique_ports = set()
            for container_port, host_ports in ports.items():
                if host_ports:
                    for mapping in host_ports:
                        port_key = f"{container_port.split('/')[0]}-{mapping['HostPort']}"
                        if port_key not in unique_ports:
                            unique_ports.add(port_key)
                            container_info["ports"].append({
                                "container_port": container_port.split("/")[0],
                                "host_port": mapping["HostPort"]
                            })

        # 获取网络模式
        network_mode = container.attrs.get("HostConfig", {}).get("NetworkMode")
        if network_mode:
            container_info["network"] = network_mode

        # 按状态分组
        key = container.status if container.status in grouped else "other"
        grouped[key].append(container_info)

    return grouped


def get_container_stats():
    """获取所有运行中容器的资源统计信息（并行获取）"""
    client = _require_client()
    containers = client.containers.list()

    def fetch_stats(container):
        try:
            s = container.stats(stream=False)
            cpu_delta = s["cpu_stats"]["cpu_usage"]["total_usage"] - s["precpu_stats"]["cpu_usage"]["total_usage"]
            sys_delta = s["cpu_stats"]["system_cpu_usage"] - s["precpu_stats"]["system_cpu_usage"]
            cpu = (cpu_delta / sys_delta) * 100.0 if sys_delta > 0 and cpu_delta > 0 else 0
            mem_usage = s["memory_stats"].get("usage", 0)
            mem_limit = s["memory_stats"].get("limit", 1)
            return container.id, {
                "cpu_usage": round(cpu, 2),
                "memory_usage": round((mem_usage / mem_limit) * 100, 2)
            }
        except Exception as e:
            logger.error(f"获取容器 {container.name} 统计信息失败: {e}")
            return container.id, {"cpu_usage": 0, "memory_usage": 0}

    with ThreadPoolExecutor(max_workers=10) as pool:
        results = pool.map(fetch_stats, containers)

    return dict(results)


def start_container(container_id):
    """启动容器"""
    client = _require_client()
    client.containers.get(container_id).start()
    return True


def stop_container(container_id):
    """停止容器"""
    client = _require_client()
    client.containers.get(container_id).stop()
    return True


def restart_container(container_id):
    """重启容器"""
    client = _require_client()
    client.containers.get(container_id).restart()
    return True


def unpause_container(container_id):
    """恢复暂停的容器"""
    client = _require_client()
    client.containers.get(container_id).unpause()
    return True


def get_container_logs(container_id, tail=500):
    """获取容器日志"""
    client = _require_client()
    return client.containers.get(container_id).logs(tail=tail).decode('utf-8', errors='replace')
