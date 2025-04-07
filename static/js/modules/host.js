/**
 * 宿主机管理模块
 * 负责处理宿主机IP的存储和更新
 */

// 初始化宿主机 IP
function initHostIP() {
  const hostInput = document.getElementById("host-ip");
  if (!hostInput) return;
  
  const savedIP = localStorage.getItem("host_ip") || "";
  hostInput.value = savedIP;
  
  hostInput.addEventListener("change", () => {
    localStorage.setItem("host_ip", hostInput.value);
    // 通知其他模块IP已更新
    document.dispatchEvent(new CustomEvent('hostIpChanged', {
      detail: { ip: hostInput.value }
    }));
  });
}

// 获取当前宿主机IP
function getHostIP() {
  return document.getElementById("host-ip")?.value || localStorage.getItem("host_ip") || "localhost";
}

export { initHostIP, getHostIP };
