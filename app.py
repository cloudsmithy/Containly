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

@app.route('/api/exec/<container_id>', methods=['POST'])
def container_exec_api(container_id):
    """在容器中执行命令（非交互式）"""
    try:
        logger.info(f"执行容器命令: {container_id}")
        container = client.containers.get(container_id)
        
        # 检查容器是否在运行
        if container.status != "running":
            logger.warning(f"容器未运行: {container_id}")
            return jsonify({"success": False, "error": "容器未运行，无法执行命令"})
        
        # 获取要执行的命令和工作目录
        data = request.get_json()
        if not data or 'command' not in data:
            logger.warning("未提供命令")
            return jsonify({"success": False, "error": "未提供命令"})
        
        command = data['command']
        working_dir = data.get('cwd', '/')
        logger.info(f"执行命令: {command}, 工作目录: {working_dir}")
        
        # 特殊命令处理
        if command == "clear" or command == "cls":
            return jsonify({
                "success": True,
                "exit_code": 0,
                "output": ""  # 清屏由前端处理
            })
        
        # 对于 top 命令，添加 -n 1 参数使其只执行一次
        if command == "top" or command.startswith("top "):
            if " -n " not in command and " -b" not in command:
                command = command.replace("top", "top -n 1 -b", 1)
        
        # 对于 htop 命令，提示不支持
        if command == "htop" or command.startswith("htop "):
            return jsonify({
                "success": True,
                "exit_code": 1,
                "output": "htop 是交互式命令，在此终端中无法正常工作。请使用 top -n 1 代替。"
            })
        
        # 对于 vim, nano 等交互式命令，提示不支持
        interactive_commands = ['vim', 'vi', 'nano', 'emacs', 'less', 'more']
        for cmd in interactive_commands:
            if command == cmd or command.startswith(cmd + ' '):
                return jsonify({
                    "success": True,
                    "exit_code": 1,
                    "output": f"{cmd} 是交互式命令，在此终端中无法正常工作。请使用 cat 查看文件内容。"
                })
        
        # 执行命令，指定工作目录
        try:
            # 使用 shell 命令执行，确保 cd 命令在 shell 中执行
            result = container.exec_run(["/bin/sh", "-c", f"cd {working_dir} && {command}"], tty=True)
            
            # 返回执行结果
            output = result.output.decode('utf-8', errors='replace')
            logger.info(f"命令执行完成，退出码: {result.exit_code}")
            return jsonify({
                "success": True,
                "exit_code": result.exit_code,
                "output": output
            })
        except Exception as e:
            logger.error(f"执行命令失败: {str(e)}")
            return jsonify({"success": False, "error": f"执行命令失败: {str(e)}"})
    except Exception as e:
        logger.error(f"在容器中执行命令失败 {container_id}: {str(e)}")
        return jsonify({"success": False, "error": str(e)})

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

if __name__ == "__main__":
    # 打印所有注册的路由
    print("注册的路由:")
    for rule in app.url_map.iter_rules():
        print(f"{rule.endpoint}: {rule}")
    
    app.run(host="0.0.0.0", port=PORT, debug=DEBUG)
