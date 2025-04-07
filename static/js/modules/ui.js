/**
 * UI工具模块
 * 提供通用UI操作函数
 */

// 显示提示消息
function showToast(msg, duration = 3000) {
  // 只显示错误消息，成功消息不显示
  if (msg.includes('失败') || msg.includes('错误') || msg.includes('已复制') || msg.includes('黑名单')) {
    // 获取或创建 toast 容器
    let toastContainer = document.getElementById("toast-container");
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.id = "toast-container";
      toastContainer.style.position = "fixed";
      toastContainer.style.top = "10px";
      toastContainer.style.right = "10px";
      toastContainer.style.zIndex = "9999";
      document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = msg;
    toastContainer.appendChild(toast);
    
    if (duration > 0) {
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, duration);
    }
  }
}

// 添加加载特效覆盖层
function addLoadingOverlay(element, message) {
  // 创建加载覆盖层
  const overlay = document.createElement("div");
  overlay.className = "card-loading";
  overlay.innerHTML = `
    <div class="loader"></div>
    <div class="card-loading-text">${message}</div>
  `;
  
  // 添加到元素
  element.appendChild(overlay);
}

// 移除加载特效覆盖层
function removeLoadingOverlay(element) {
  const overlay = element.querySelector(".card-loading");
  if (overlay) {
    overlay.remove();
  }
}

// 初始化日志查看功能
function initLogViewer() {
  const logViewer = document.querySelector(".log-viewer");
  const closeBtn = document.querySelector(".log-close");
  
  if (!logViewer || !closeBtn) return;
  
  closeBtn.addEventListener("click", () => {
    logViewer.classList.remove("active");
  });
  
  // 点击背景关闭
  logViewer.addEventListener("click", (e) => {
    if (e.target === logViewer) {
      logViewer.classList.remove("active");
    }
  });
  
  // ESC 键关闭
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && logViewer.classList.contains("active")) {
      logViewer.classList.remove("active");
    }
  });
}

// 显示日志
function showLogs(containerId, logs) {
  const logViewer = document.querySelector(".log-viewer");
  const logContent = document.querySelector(".log-content");
  
  if (!logViewer || !logContent) return;
  
  logContent.textContent = logs;
  logViewer.classList.add("active");
}

export { 
  showToast, 
  addLoadingOverlay, 
  removeLoadingOverlay, 
  initLogViewer,
  showLogs
};
