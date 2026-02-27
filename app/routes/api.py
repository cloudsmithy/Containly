#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import functools
from flask import jsonify, request
from app import app
from app.services.container_service import (
    get_all_containers,
    get_container_stats,
    start_container,
    stop_container,
    restart_container,
    get_container_logs,
    delete_container,
    get_all_images,
    delete_image
)
from app.docker_client import get_docker_client
import logging

logger = logging.getLogger(__name__)


def api_error_handler(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except ConnectionError as e:
            return jsonify({"success": False, "error": str(e)}), 500
        except Exception as e:
            logger.error(f"{f.__name__} 失败: {e}")
            return jsonify({"success": False, "error": str(e)}), 500
    return wrapper


@app.route('/api/containers/all')
@api_error_handler
def api_get_all_containers():
    return jsonify({"success": True, "containers": get_all_containers()})


@app.route('/api/health')
def api_health():
    from app.docker_client import is_connected
    return jsonify({"docker": is_connected()})


@app.route('/api/images/all')
@api_error_handler
def api_get_all_images():
    return jsonify({"success": True, "images": get_all_images()})


@app.route('/api/containers/stats')
@api_error_handler
def api_get_container_stats():
    return jsonify({"success": True, "stats": get_container_stats()})


@app.route('/api/start/<container_id>', methods=['POST'])
@api_error_handler
def api_start_container(container_id):
    start_container(container_id)
    return jsonify({"success": True})


@app.route('/api/stop/<container_id>', methods=['POST'])
@api_error_handler
def api_stop_container(container_id):
    stop_container(container_id)
    return jsonify({"success": True})


@app.route('/api/restart/<container_id>', methods=['POST'])
@api_error_handler
def api_restart_container(container_id):
    restart_container(container_id)
    return jsonify({"success": True})


@app.route('/api/unpause/<container_id>', methods=['POST'])
@api_error_handler
def api_unpause_container(container_id):
    from app.services.container_service import unpause_container
    unpause_container(container_id)
    return jsonify({"success": True})


@app.route('/api/delete/container/<container_id>', methods=['DELETE'])
@api_error_handler
def api_delete_container(container_id):
    force = request.args.get('force', 'false').lower() == 'true'
    delete_container(container_id, force=force)
    return jsonify({"success": True})


@app.route('/api/delete/image/<image_id>', methods=['DELETE'])
@api_error_handler
def api_delete_image(image_id):
    force = request.args.get('force', 'false').lower() == 'true'
    delete_image(image_id, force=force)
    return jsonify({"success": True})


@app.route('/api/check-port')
@api_error_handler
def api_check_port():
    import socket
    host = request.args.get('host', 'localhost')
    port = request.args.get('port', type=int)
    if not port:
        return jsonify({"success": False, "error": "缺少端口参数"}), 400
    try:
        with socket.create_connection((host, port), timeout=2):
            return jsonify({"success": True, "reachable": True})
    except (OSError, TimeoutError):
        return jsonify({"success": True, "reachable": False})


@app.route('/api/logs/<container_id>')
@api_error_handler
def api_get_container_logs(container_id):
    return get_container_logs(container_id)


@app.route('/api/exec/<container_id>', methods=['POST'])
@api_error_handler
def api_exec_command(container_id):
    data = request.json
    command = data.get('command')

    if not command:
        return jsonify({"success": False, "error": "缺少命令参数"}), 400

    client = get_docker_client()
    if not client:
        return jsonify({"success": False, "error": "Docker连接失败"}), 500

    container = client.containers.get(container_id)
    result = container.exec_run(command, tty=False)

    return jsonify({
        "success": True,
        "exit_code": result.exit_code,
        "output": result.output.decode('utf-8', errors='replace')
    })
