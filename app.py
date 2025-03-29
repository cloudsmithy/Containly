import os
import time
import logging
import threading
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
import docker

# 配置日志
logging.basicConfig(
    level=logging.DEBUG,  # 改为 DEBUG 级别以便调试
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static', static_url_path='/static')
app.config['SECRET_KEY'] = 'containly-secret-key'
socketio = SocketIO(app, cors_allowed_origins="*")

# 环境变量配置
DEBUG = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
PORT = int(os.environ.get('PORT', 5001))
REFRESH_INTERVAL = int(os.environ.get('REFRESH_INTERVAL', 30))
LOG_LINES = int(os.environ.get('LOG_LINES', 100))

# 容器数据缓存
container_cache = {"data": None, "timestamp": 0, "ttl": 120}

# 终端会话存储
terminal_sessions = {}

try:
    client = docker.from_env()
    logger.info("成功连接到 Docker")
except Exception as e:
    logger.error(f"无法连接到 Docker: {str(e)}")
    client = None

def get_containers(with_stats=False):
    """获取容器列表，带缓存机制"""
    global container_cache
    current_time = time.time()
    
    # 如果缓存有效，直接返回缓存数据
    if container_cache["data"] and current_time - container_cache["timestamp"] < container_cache["ttl"]:
        return container_cache["data"]
    
    # 否则重新获取数据
    try:
        containers = client.containers.list(all=True)
        container_cache["data"] = containers
        container_cache["timestamp"] = current_time
        return containers
    except Exception as e:
        logger.error(f"获取容器列表失败: {str(e)}")
        return []

@app.route("/")
def index():
    """主页视图 - 只返回基本框架，容器数据通过API异步加载"""
    if not client:
        return render_template("error.html", message="无法连接到 Docker 守护进程")
    
    try:
        # 只返回页面框架，不包含容器数据
        return render_template("index.html", refresh_interval=REFRESH_INTERVAL)
    except Exception as e:
        logger.error(f"渲染主页失败: {str(e)}")
        return render_template("error.html", message=f"获取容器信息失败: {str(e)}")

@app.route("/api/containers/all")
def get_all_containers():
    """API端点：获取所有容器的基本信息（不包含资源统计）"""
    try:
        containers = get_containers()
        grouped = {"running": [], "exited": [], "paused": [], "other": []}

        for container in containers:
            info = container.attrs
            status = container.status
            name = container.name
            network_mode = info['HostConfig']['NetworkMode']
            ports = info['NetworkSettings']['Ports'] or {}

            port_mappings = []
            port_set = set()

            for container_port, mappings in ports.items():
                if mappings:
                    for map_info in mappings:
                        host_port = int(map_info['HostPort'])
                        container_port_num = int(container_port.split("/")[0])
                        key = (host_port, container_port_num)
                        if key not in port_set:
                            port_set.add(key)
                            port_mappings.append({
                                "host_port": host_port,
                                "container_port": container_port_num
                            })

            container_data = {
                "id": container.id,
                "name": name,
                "network": network_mode,
                "status": status,
                "ports": port_mappings,
                "cpu_usage": 0,  # 初始值为0，资源统计将通过单独的API获取
                "memory_usage": 0
            }

            if status in grouped:
                grouped[status].append(container_data)
            else:
                grouped["other"].append(container_data)

        return jsonify({"success": True, "containers": grouped})
    except Exception as e:
        logger.error(f"获取容器列表失败: {str(e)}")
        return jsonify({"success": False, "error": str(e)})

@app.route("/api/containers/stats")
def get_containers_stats():
    """API端点：获取运行中容器的资源统计信息"""
    try:
        containers = get_containers()
        stats = {}

        # 只获取运行中容器的资源统计
        for container in containers:
            if container.status != "running":
                continue
                
            try:
                container_stats = container.stats(stream=False)
                cpu_usage = calculate_cpu_usage(container_stats)
                memory_usage = calculate_memory_usage(container_stats)
                
                stats[container.id] = {
                    "cpu_usage": cpu_usage,
                    "memory_usage": memory_usage
                }
            except Exception as e:
                logger.error(f"获取容器资源使用情况失败 {container.id}: {str(e)}")
                stats[container.id] = {
                    "cpu_usage": 0,
                    "memory_usage": 0
                }

        return jsonify({"success": True, "stats": stats})
    except Exception as e:
        logger.error(f"获取容器资源统计失败: {str(e)}")
        return jsonify({"success": False, "error": str(e)})

def calculate_cpu_usage(stats):
    """计算CPU使用率 - 简化计算"""
    try:
        cpu_delta = stats["cpu_stats"]["cpu_usage"]["total_usage"] - stats["precpu_stats"]["cpu_usage"]["total_usage"]
        system_delta = stats["cpu_stats"]["system_cpu_usage"] - stats["precpu_stats"]["system_cpu_usage"]
        online_cpus = stats["cpu_stats"].get("online_cpus", len(stats["cpu_stats"]["cpu_usage"].get("percpu_usage", [1])))
        
        if system_delta > 0 and online_cpus > 0:
            return round((cpu_delta / system_delta) * online_cpus * 100, 2)
        return 0
    except:
        return 0

def calculate_memory_usage(stats):
    """计算内存使用率 - 简化计算"""
    try:
        used_memory = stats["memory_stats"]["usage"]
        available_memory = stats["memory_stats"]["limit"]
        
        if available_memory > 0:
            return round((used_memory / available_memory) * 100, 2)
        return 0
    except:
        return 0

@app.route("/blacklist")
def blacklist_page():
    """黑名单管理界面"""
    return render_template("blacklist.html")

# API 路由 - 使用 GET 请求以便于前端调用
@app.route("/api/start/<container_id>")
def start_container(container_id):
    """启动容器"""
    try:
        container = client.containers.get(container_id)
        container.start()
        logger.info(f"容器已启动: {container_id}")
        return jsonify({"success": True, "status": "started"})
    except Exception as e:
        logger.error(f"启动容器失败 {container_id}: {str(e)}")
        return jsonify({"success": False, "error": str(e)})

@app.route("/api/stop/<container_id>")
def stop_container(container_id):
    """停止容器"""
    try:
        container = client.containers.get(container_id)
        container.stop()
        logger.info(f"容器已停止: {container_id}")
        return jsonify({"success": True, "status": "stopped"})
    except Exception as e:
        logger.error(f"停止容器失败 {container_id}: {str(e)}")
        return jsonify({"success": False, "error": str(e)})

@app.route("/api/restart/<container_id>")
def restart_container(container_id):
    """重启容器"""
    try:
        container = client.containers.get(container_id)
        container.restart()
        logger.info(f"容器已重启: {container_id}")
        return jsonify({"success": True, "status": "restarted"})
    except Exception as e:
        logger.error(f"重启容器失败 {container_id}: {str(e)}")
        return jsonify({"success": False, "error": str(e)})
    
@app.route('/api/status/<container_id>')
def container_status(container_id):
    """获取容器状态"""
    try:
        container = client.containers.get(container_id)
        return jsonify({"success": True, "running": container.status == "running"})
    except Exception as e:
        logger.error(f"获取容器状态失败 {container_id}: {str(e)}")
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/logs/<container_id>')
def container_logs(container_id):
    """获取容器日志"""
    try:
        container = client.containers.get(container_id)
        logs = container.logs(tail=LOG_LINES, timestamps=True).decode('utf-8', errors='replace')
        return logs
    except Exception as e:
        logger.error(f"获取容器日志失败 {container_id}: {str(e)}")
        return f"获取日志失败: {str(e)}", 400

@app.route('/static/<path:path>')
def serve_static(path):
    """提供静态文件"""
    return send_from_directory('static', path)

@app.errorhandler(404)
def page_not_found(e):
    """404错误处理"""
    return render_template('error.html', message='页面不存在'), 404

@app.errorhandler(500)
def server_error(e):
    """500错误处理"""
    logger.error(f"服务器错误: {str(e)}")
    return render_template('error.html', message='服务器内部错误'), 500

# 容器终端功能
@app.route('/terminal/<container_id>')
def terminal_page(container_id):
    """容器终端页面"""
    try:
        logger.info(f"访问终端页面: {container_id}")
        container = client.containers.get(container_id)
        logger.info(f"找到容器: {container.name}")
        return render_template("terminal.html", container_id=container_id, container_name=container.name)
    except Exception as e:
        logger.error(f"加载终端页面失败 {container_id}: {str(e)}")
        return render_template("error.html", message=f"加载终端页面失败: {str(e)}")

@socketio.on('connect')
def handle_connect():
    logger.info(f"客户端连接: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    """处理客户端断开连接"""
    sid = request.sid
    logger.info(f"客户端断开连接: {sid}")
    # 清理终端会话
    if sid in terminal_sessions:
        container_id = terminal_sessions[sid]['container_id']
        exec_id = terminal_sessions[sid]['exec_id']
        logger.info(f"清理终端会话: {container_id}, exec_id: {exec_id}")
        try:
            # 尝试关闭容器中的会话
            client.api.exec_resize(exec_id, height=1, width=1)
        except:
            pass
        del terminal_sessions[sid]

@socketio.on('terminal_init')
def handle_terminal_init(data):
    """初始化终端会话"""
    container_id = data.get('container_id')
    if not container_id:
        emit('terminal_error', {'error': '未提供容器ID'})
        return
    
    try:
        container = client.containers.get(container_id)
        if container.status != "running":
            emit('terminal_error', {'error': '容器未运行，无法连接终端'})
            return
        
        # 检测容器中可用的 shell
        shell = "/bin/sh"  # 默认使用 sh
        try:
            result = container.exec_run("which bash")
            if result.exit_code == 0:
                shell = "/bin/bash"
        except:
            pass
        
        logger.info(f"为容器 {container_id} 创建交互式会话，使用 shell: {shell}")
        
        # 创建交互式会话
        try:
            exec_instance = client.api.exec_create(
                container_id,
                shell,
                stdin=True,
                tty=True
            )
            
            exec_id = exec_instance['Id']
            logger.info(f"创建的 exec ID: {exec_id}")
            
            socket = client.api.exec_start(
                exec_id,
                socket=True,
                tty=True,
                demux=False
            )
            
            logger.info("成功启动 exec 实例")
            
            # 保存当前的 sid，以便在线程中使用
            sid = request.sid
            
            # 存储会话信息
            terminal_sessions[sid] = {
                'container_id': container_id,
                'exec_id': exec_id,
                'socket': socket
            }
            
            # 启动读取线程
            def read_socket():
                logger.info(f"启动读取线程，sid: {sid}")
                try:
                    while sid in terminal_sessions:
                        try:
                            data = socket._sock.recv(4096)
                            if not data:
                                logger.info(f"接收到空数据，终止会话 {sid}")
                                break
                            
                            output = data.decode('utf-8', errors='replace')
                            logger.debug(f"接收到输出数据: {len(output)} 字节")
                            socketio.emit('terminal_output', {'output': output}, room=sid)
                        except Exception as e:
                            logger.error(f"读取终端输出错误: {str(e)}")
                            break
                    
                    # 会话结束
                    logger.info(f"读取线程结束，sid: {sid}")
                    if sid in terminal_sessions:
                        del terminal_sessions[sid]
                        socketio.emit('terminal_closed', room=sid)
                except Exception as e:
                    logger.error(f"读取线程异常: {str(e)}")
            
            thread = threading.Thread(target=read_socket)
            thread.daemon = True
            thread.start()
            
            emit('terminal_ready', {'shell': shell})
            logger.info(f"终端会话初始化成功: {container_id}")
            
        except Exception as e:
            logger.error(f"创建或启动 exec 实例失败: {str(e)}")
            emit('terminal_error', {'error': f'创建终端会话失败: {str(e)}'})
            
    except Exception as e:
        logger.error(f"初始化终端会话失败: {str(e)}")
        emit('terminal_error', {'error': f'初始化终端会话失败: {str(e)}'})

@socketio.on('terminal_input')
def handle_terminal_input(data):
    """处理终端输入"""
    sid = request.sid
    if sid not in terminal_sessions:
        emit('terminal_error', {'error': '终端会话不存在'})
        return
    
    try:
        socket = terminal_sessions[sid]['socket']
        input_data = data.get('input', '')
        logger.debug(f"接收到终端输入: {repr(input_data)}, 长度: {len(input_data)}")
        
        # 确保输入数据是字节
        if isinstance(input_data, str):
            input_bytes = input_data.encode('utf-8')
        else:
            input_bytes = input_data
            
        # 发送输入到容器
        socket._sock.sendall(input_bytes)
        logger.debug(f"已发送 {len(input_bytes)} 字节到容器")
    except Exception as e:
        logger.error(f"发送终端输入错误: {str(e)}")
        emit('terminal_error', {'error': f'发送终端输入错误: {str(e)}'})

@socketio.on('terminal_resize')
def handle_terminal_resize(data):
    """调整终端大小"""
    sid = request.sid
    if sid not in terminal_sessions:
        return
    
    try:
        exec_id = terminal_sessions[sid]['exec_id']
        rows = data.get('rows', 24)
        cols = data.get('cols', 80)
        logger.debug(f"调整终端大小: rows={rows}, cols={cols}, exec_id={exec_id}")
        client.api.exec_resize(exec_id, height=rows, width=cols)
        logger.debug("终端大小调整成功")
    except Exception as e:
        logger.error(f"调整终端大小错误: {str(e)}")

if __name__ == "__main__":
    # 打印所有注册的路由
    print("注册的路由:")
    for rule in app.url_map.iter_rules():
        print(f"{rule.endpoint}: {rule}")
    
    socketio.run(app, host="0.0.0.0", port=PORT, debug=DEBUG, allow_unsafe_werkzeug=True)
