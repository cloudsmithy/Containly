from flask import Flask, render_template, request, jsonify
import docker

app = Flask(__name__)
client = docker.from_env()

@app.route("/")
def index():
    containers = client.containers.list(all=True)
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
            "ports": port_mappings
        }

        if status in grouped:
            grouped[status].append(container_data)
        else:
            grouped["other"].append(container_data)

    return render_template("index.html", grouped=grouped)

@app.route("/blacklist")
def blacklist_page():
    # 黑名单管理界面；前端 LocalStorage 存储被拉黑的容器
    return render_template("blacklist.html")

@app.route("/container/<container_id>/start", methods=["POST"])
def start_container(container_id):
    try:
        container = client.containers.get(container_id)
        container.start()
        return jsonify({"status": "started"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/container/<container_id>/stop", methods=["POST"])
def stop_container(container_id):
    try:
        container = client.containers.get(container_id)
        container.stop()
        return jsonify({"status": "stopped"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/container/<container_id>/restart", methods=["POST"])
def restart_container(container_id):
    try:
        container = client.containers.get(container_id)
        container.restart()
        return jsonify({"status": "restarted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
