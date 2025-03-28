from flask import Flask, render_template
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

if __name__ == "__main__":
    app.run(debug=True)
