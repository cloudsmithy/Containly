// 页面加载完成后执行
document.addEventListener("DOMContentLoaded", () => {
  // 初始化主题
  initTheme();
  
  // 初始化宿主机 IP
  initHostIP();
  
  // 初始化卡片操作切换
  initCardToggleActions();
  
  // 初始化端口检测
  initPortCheck();
  
  // 初始化复制功能
  initCopyable();
  
  // 初始化容器操作
  initContainerActions();
  
  // 初始化协议切换
  initProtocolToggle();
  
  // 初始化黑名单功能
  initBlacklist();
  
  // 初始化日志查看功能
  initLogViewer();
  
  // 自动刷新
  setInterval(() => {
    location.reload();
  }, 30000); // 30秒
});

// 初始化主题
function initTheme() {
  const theme = localStorage.getItem("theme");
  const darkBtn = document.getElementById("darkBtn");
  
  if (theme === "dark") {
    document.body.classList.add("dark");
    darkBtn.textContent = "☀️";
  } else {
    darkBtn.textContent = "🌙";
  }
  
  darkBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const isDark = document.body.classList.contains("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    darkBtn.textContent = isDark ? "☀️" : "🌙";
  });
}

// 初始化宿主机 IP
function initHostIP() {
  const hostInput = document.getElementById("host-ip");
  const savedIP = localStorage.getItem("host_ip") || "";
  
  hostInput.value = savedIP;
  
  hostInput.addEventListener("change", () => {
    localStorage.setItem("host_ip", hostInput.value);
    updateLinks();
  });
  
  // 初始化时更新链接
  updateLinks();
}

// 更新所有端口链接
function updateLinks() {
  const hostIP = document.getElementById("host-ip").value || "localhost";
  
  document.querySelectorAll(".port-item").forEach(item => {
    if (!item) return;
    
    const hostPort = item.dataset.host;
    if (!hostPort) return;
    
    const link = item.querySelector(".port-link");
    if (!link) return;
    
    const card = item.closest(".card");
    if (!card) return;
    
    const protocol = card.dataset.protocol || "http";
    link.href = `${protocol}://${hostIP}:${hostPort}`;
    link.textContent = `${protocol}://${hostIP}:${hostPort}`;
  });
}

// 初始化卡片操作切换
function initCardToggleActions() {
  document.querySelectorAll(".card").forEach(card => {
    if (!card) return;
    
    let isActionsVisible = false;

    // 点击卡片时切换按钮显示状态
    card.addEventListener("click", (e) => {
      // 如果点击的是按钮、可复制元素或链接，不触发切换
      if (e.target.classList.contains('action-btn') || 
          e.target.classList.contains('copyable') || 
          e.target.tagName === 'A') return;
          
      isActionsVisible = !isActionsVisible;
      card.classList.toggle("show-actions", isActionsVisible);
    });

    // 鼠标进入时显示按钮
    card.addEventListener("mouseenter", () => {
      card.classList.add("show-actions");
    });

    // 鼠标离开时，如果不是通过点击保持显示的，则隐藏按钮
    card.addEventListener("mouseleave", () => {
      if (!isActionsVisible) {
        card.classList.remove("show-actions");
      }
    });
  });
}

// 初始化端口检测
function initPortCheck() {
  const hostIP = document.getElementById("host-ip").value || "localhost";
  
  document.querySelectorAll(".port-item").forEach(item => {
    if (!item) return;
    
    const hostPort = item.dataset.host;
    if (!hostPort) return;
    
    const indicator = item.querySelector(".status-indicator");
    if (!indicator) return;
    
    const card = item.closest(".card");
    if (!card) return;
    
    const protocol = card.dataset.protocol || "http";
    const url = `${protocol}://${hostIP}:${hostPort}`;
    
    // 检测端口是否可达
    fetch(url, { mode: 'no-cors', cache: 'no-store' })
      .then(() => {
        indicator.classList.add("open");
        indicator.classList.remove("closed");
        indicator.title = "可访问";
      })
      .catch(() => {
        indicator.classList.add("closed");
        indicator.classList.remove("open");
        indicator.title = "不可访问";
      });
  });
}

// 初始化复制功能
function initCopyable() {
  document.querySelectorAll(".copyable").forEach(el => {
    if (!el) return;
    
    el.addEventListener("click", () => {
      const text = el.textContent;
      navigator.clipboard.writeText(text)
        .then(() => {
          showToast(`已复制: ${text}`);
          
          // 添加复制动画
          el.style.backgroundColor = "var(--copy-bg)";
          setTimeout(() => {
            el.style.backgroundColor = "";
          }, 300);
        })
        .catch(err => {
          console.error('复制失败:', err);
        });
    });
  });
}

// 初始化容器操作
function initContainerActions() {
  // 启动容器
  document.querySelectorAll(".start-btn").forEach(btn => {
    if (!btn) return;
    btn.onclick = () => {
      const containerId = btn.dataset.id;
      const card = btn.closest(".card");
      
      // 添加加载特效
      addLoadingOverlay(card, "正在启动容器...");
      
      fetch(`/api/start/${containerId}`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`操作失败: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          if (data.success) {
            showToast("容器已启动");
            
            // 添加移动动画
            card.classList.add("card-moving");
            
            // 延迟后移动卡片到 running 分组
            setTimeout(() => {
              moveCardToSection(card, "running");
            }, 500);
          } else {
            // 移除加载特效
            removeLoadingOverlay(card);
            showToast(`启动失败: ${data.error || '未知错误'}`);
          }
        })
        .catch(error => {
          // 移除加载特效
          removeLoadingOverlay(card);
          showToast(`请求错误: ${error.message}`);
        });
    };
  });
  
  // 停止容器
  document.querySelectorAll(".stop-btn").forEach(btn => {
    if (!btn) return;
    btn.onclick = () => {
      const containerId = btn.dataset.id;
      const card = btn.closest(".card");
      
      // 添加加载特效
      addLoadingOverlay(card, "正在停止容器...");
      
      fetch(`/api/stop/${containerId}`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`操作失败: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          if (data.success) {
            showToast("容器已停止");
            
            // 添加移动动画
            card.classList.add("card-moving");
            
            // 延迟后移动卡片到 exited 分组
            setTimeout(() => {
              moveCardToSection(card, "exited");
            }, 500);
          } else {
            // 移除加载特效
            removeLoadingOverlay(card);
            showToast(`停止失败: ${data.error || '未知错误'}`);
          }
        })
        .catch(error => {
          // 移除加载特效
          removeLoadingOverlay(card);
          showToast(`请求错误: ${error.message}`);
        });
    };
  });
  
  // 重启容器
  document.querySelectorAll(".restart-btn").forEach(btn => {
    if (!btn) return;
    btn.onclick = () => {
      const containerId = btn.dataset.id;
      const card = btn.closest(".card");
      
      // 添加加载特效
      addLoadingOverlay(card, "正在重启容器...");
      
      fetch(`/api/restart/${containerId}`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`操作失败: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          if (data.success) {
            showToast("容器已重启");
            
            // 由于重启后状态不变，只需刷新卡片
            setTimeout(() => {
              location.reload();
            }, 1000);
          } else {
            // 移除加载特效
            removeLoadingOverlay(card);
            showToast(`重启失败: ${data.error || '未知错误'}`);
          }
        })
        .catch(error => {
          // 移除加载特效
          removeLoadingOverlay(card);
          showToast(`请求错误: ${error.message}`);
        });
    };
  });
  
  // 查看日志
  document.querySelectorAll(".logs-btn").forEach(btn => {
    if (!btn) return;
    btn.onclick = () => {
      const containerId = btn.dataset.id;
      if (!containerId) return;
      
      const logViewer = document.querySelector(".log-viewer");
      const logContent = document.querySelector(".log-content");
      
      if (!logViewer || !logContent) return;
      
      // 显示加载中
      logContent.innerHTML = '<div class="loader"></div> 加载中...';
      logViewer.classList.add("active");
      
      // 获取日志
      fetch(`/api/logs/${containerId}`)
        .then(response => response.text())
        .then(logs => {
          logContent.textContent = logs;
        })
        .catch(error => {
          logContent.textContent = `获取日志失败: ${error.message}`;
        });
    };
  });
}

// 添加加载特效覆盖层
function addLoadingOverlay(card, message) {
  // 创建加载覆盖层
  const overlay = document.createElement("div");
  overlay.className = "card-loading";
  overlay.innerHTML = `
    <div class="loader"></div>
    <div class="card-loading-text">${message}</div>
  `;
  
  // 添加到卡片
  card.appendChild(overlay);
}

// 移除加载特效覆盖层
function removeLoadingOverlay(card) {
  const overlay = card.querySelector(".card-loading");
  if (overlay) {
    overlay.remove();
  }
}

// 将卡片移动到指定状态分组
function moveCardToSection(card, targetStatus) {
  // 获取目标分组
  const targetSection = document.querySelector(`.section[data-status="${targetStatus}"]`);
  if (!targetSection) {
    // 如果找不到目标分组，刷新页面
    location.reload();
    return;
  }
  
  // 获取目标分组的网格容器
  const targetGrid = targetSection.querySelector(".grid");
  if (!targetGrid) {
    location.reload();
    return;
  }
  
  // 获取当前分组
  const currentSection = card.closest(".section");
  const currentGrid = currentSection.querySelector(".grid");
  
  // 克隆卡片以保留其数据
  const clonedCard = card.cloneNode(true);
  
  // 移除原卡片
  card.remove();
  
  // 检查原分组是否为空
  if (currentGrid.children.length === 0) {
    currentGrid.innerHTML = `<div class="empty-state">没有${currentSection.dataset.status}状态的容器</div>`;
  }
  
  // 检查目标分组是否有空状态提示
  const emptyState = targetGrid.querySelector(".empty-state");
  if (emptyState) {
    emptyState.remove();
  }
  
  // 添加到目标分组
  targetGrid.appendChild(clonedCard);
  
  // 移除加载特效和移动动画类
  removeLoadingOverlay(clonedCard);
  clonedCard.classList.remove("card-moving");
  
  // 重新初始化卡片事件
  initCardEvents(clonedCard);
  
  // 更新卡片内容以反映新状态
  updateCardForNewStatus(clonedCard, targetStatus);
}

// 更新卡片内容以反映新状态
function updateCardForNewStatus(card, newStatus) {
  const actionsDiv = card.querySelector(".card-actions");
  const containerId = card.dataset.containerId;
  
  // 清空操作按钮
  actionsDiv.innerHTML = '';
  
  // 根据新状态添加适当的按钮
  if (newStatus === "running") {
    actionsDiv.innerHTML = `
      <button class="action-btn stop-btn" data-id="${containerId}" title="停止容器">🛑</button>
      <button class="action-btn restart-btn" data-id="${containerId}" title="重启容器">🔄</button>
      <button class="action-btn logs-btn" data-id="${containerId}" title="查看日志">📋</button>
      <button class="action-btn protocol-btn" title="切换协议">🔐</button>
      <button class="action-btn blacklist-btn" title="加入黑名单">🚫</button>
    `;
    
    // 添加资源使用情况占位符
    if (!card.querySelector(".resource-usage")) {
      const resourceUsage = document.createElement("div");
      resourceUsage.className = "resource-usage";
      resourceUsage.innerHTML = `
        <div class="resource-bar">
          <div class="resource-fill" style="width: 0%"></div>
        </div>
        <div class="resource-text">CPU: 0%</div>
        
        <div class="resource-bar">
          <div class="resource-fill" style="width: 0%"></div>
        </div>
        <div class="resource-text">内存: 0%</div>
      `;
      
      // 插入到标签后面
      const tag = card.querySelector(".tag");
      tag.parentNode.insertBefore(resourceUsage, tag.nextSibling);
    }
  } else if (newStatus === "exited") {
    actionsDiv.innerHTML = `
      <button class="action-btn start-btn" data-id="${containerId}" title="启动容器">▶️</button>
      <button class="action-btn logs-btn" data-id="${containerId}" title="查看日志">📋</button>
      <button class="action-btn protocol-btn" title="切换协议">🔐</button>
      <button class="action-btn blacklist-btn" title="加入黑名单">🚫</button>
    `;
    
    // 移除资源使用情况
    const resourceUsage = card.querySelector(".resource-usage");
    if (resourceUsage) {
      resourceUsage.remove();
    }
  }
  
  // 重新初始化卡片上的所有事件
  initCardEvents(card);
}

// 初始化单个卡片的事件
function initCardEvents(card) {
  // 初始化卡片操作切换
  let isActionsVisible = false;
  
  card.addEventListener("click", (e) => {
    if (e.target.classList.contains('action-btn') || 
        e.target.classList.contains('copyable') || 
        e.target.tagName === 'A') return;
        
    isActionsVisible = !isActionsVisible;
    card.classList.toggle("show-actions", isActionsVisible);
  });
  
  card.addEventListener("mouseenter", () => {
    card.classList.add("show-actions");
  });
  
  card.addEventListener("mouseleave", () => {
    if (!isActionsVisible) {
      card.classList.remove("show-actions");
    }
  });
  
  // 初始化启动按钮
  const startBtn = card.querySelector(".start-btn");
  if (startBtn) {
    startBtn.onclick = () => {
      const containerId = startBtn.dataset.id;
      
      // 添加加载特效
      addLoadingOverlay(card, "正在启动容器...");
      
      fetch(`/api/start/${containerId}`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`操作失败: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          if (data.success) {
            showToast("容器已启动");
            
            // 添加移动动画
            card.classList.add("card-moving");
            
            // 延迟后移动卡片到 running 分组
            setTimeout(() => {
              moveCardToSection(card, "running");
            }, 500);
          } else {
            // 移除加载特效
            removeLoadingOverlay(card);
            showToast(`启动失败: ${data.error || '未知错误'}`);
          }
        })
        .catch(error => {
          // 移除加载特效
          removeLoadingOverlay(card);
          showToast(`请求错误: ${error.message}`);
        });
    };
  }
  
  // 初始化停止按钮
  const stopBtn = card.querySelector(".stop-btn");
  if (stopBtn) {
    stopBtn.onclick = () => {
      const containerId = stopBtn.dataset.id;
      
      // 添加加载特效
      addLoadingOverlay(card, "正在停止容器...");
      
      fetch(`/api/stop/${containerId}`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`操作失败: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          if (data.success) {
            showToast("容器已停止");
            
            // 添加移动动画
            card.classList.add("card-moving");
            
            // 延迟后移动卡片到 exited 分组
            setTimeout(() => {
              moveCardToSection(card, "exited");
            }, 500);
          } else {
            // 移除加载特效
            removeLoadingOverlay(card);
            showToast(`停止失败: ${data.error || '未知错误'}`);
          }
        })
        .catch(error => {
          // 移除加载特效
          removeLoadingOverlay(card);
          showToast(`请求错误: ${error.message}`);
        });
    };
  }
  
  // 初始化重启按钮
  const restartBtn = card.querySelector(".restart-btn");
  if (restartBtn) {
    restartBtn.onclick = () => {
      const containerId = restartBtn.dataset.id;
      
      // 添加加载特效
      addLoadingOverlay(card, "正在重启容器...");
      
      fetch(`/api/restart/${containerId}`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`操作失败: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          if (data.success) {
            showToast("容器已重启");
            
            // 由于重启后状态不变，只需刷新卡片
            setTimeout(() => {
              location.reload();
            }, 1000);
          } else {
            // 移除加载特效
            removeLoadingOverlay(card);
            showToast(`重启失败: ${data.error || '未知错误'}`);
          }
        })
        .catch(error => {
          // 移除加载特效
          removeLoadingOverlay(card);
          showToast(`请求错误: ${error.message}`);
        });
    };
  }
  
  // 初始化日志按钮
  const logsBtn = card.querySelector(".logs-btn");
  if (logsBtn) {
    logsBtn.onclick = () => {
      const containerId = logsBtn.dataset.id;
      if (!containerId) return;
      
      const logViewer = document.querySelector(".log-viewer");
      const logContent = document.querySelector(".log-content");
      
      if (!logViewer || !logContent) return;
      
      // 显示加载中
      logContent.innerHTML = '<div class="loader"></div> 加载中...';
      logViewer.classList.add("active");
      
      // 获取日志
      fetch(`/api/logs/${containerId}`)
        .then(response => response.text())
        .then(logs => {
          logContent.textContent = logs;
        })
        .catch(error => {
          logContent.textContent = `获取日志失败: ${error.message}`;
        });
    };
  }
  
  // 初始化协议切换按钮
  const protocolBtn = card.querySelector(".protocol-btn");
  const containerName = card.dataset.containerName;
  
  if (protocolBtn && containerName) {
    const storedProtocol = localStorage.getItem(`protocol_${containerName}`) || "http";
    card.dataset.protocol = storedProtocol;
    protocolBtn.textContent = storedProtocol === "http" ? "🔐" : "🔓";
    protocolBtn.title = storedProtocol === "http" ? "切换到HTTPS" : "切换到HTTP";
    
    protocolBtn.addEventListener("click", () => {
      const current = card.dataset.protocol;
      const newProtocol = current === "http" ? "https" : "http";
      card.dataset.protocol = newProtocol;
      protocolBtn.textContent = newProtocol === "http" ? "🔐" : "🔓";
      protocolBtn.title = newProtocol === "http" ? "切换到HTTPS" : "切换到HTTP";
      
      localStorage.setItem(`protocol_${containerName}`, newProtocol);
      updateLinks();
    });
  }
  
  // 初始化黑名单按钮
  const blacklistBtn = card.querySelector(".blacklist-btn");
  if (blacklistBtn) {
    blacklistBtn.addEventListener("click", () => {
      const name = card.dataset.containerName;
      if (!name) return;
      
      const blacklisted = JSON.parse(localStorage.getItem("blacklisted_containers") || "[]");
      if (!blacklisted.includes(name)) {
        blacklisted.push(name);
        localStorage.setItem("blacklisted_containers", JSON.stringify(blacklisted));
        showToast(`已将 ${name} 加入黑名单`);
      }
      card.style.display = "none";
    });
  }
  
  // 初始化复制功能
  card.querySelectorAll(".copyable").forEach(el => {
    if (!el) return;
    
    el.addEventListener("click", () => {
      const text = el.textContent;
      navigator.clipboard.writeText(text)
        .then(() => {
          showToast(`已复制: ${text}`);
          
          el.style.backgroundColor = "var(--copy-bg)";
          setTimeout(() => {
            el.style.backgroundColor = "";
          }, 300);
        })
        .catch(err => {
          console.error('复制失败:', err);
        });
    });
  });
  
  // 更新链接
  updateLinks();
  
  // 初始化端口检测
  const hostIP = document.getElementById("host-ip").value || "localhost";
  
  card.querySelectorAll(".port-item").forEach(item => {
    if (!item) return;
    
    const hostPort = item.dataset.host;
    if (!hostPort) return;
    
    const indicator = item.querySelector(".status-indicator");
    if (!indicator) return;
    
    const protocol = card.dataset.protocol || "http";
    const url = `${protocol}://${hostIP}:${hostPort}`;
    
    fetch(url, { mode: 'no-cors', cache: 'no-store' })
      .then(() => {
        indicator.classList.add("open");
        indicator.classList.remove("closed");
        indicator.title = "可访问";
      })
      .catch(() => {
        indicator.classList.add("closed");
        indicator.classList.remove("open");
        indicator.title = "不可访问";
      });
  });
}

// 初始化黑名单功能
function initBlacklist() {
  const blacklisted = JSON.parse(localStorage.getItem("blacklisted_containers") || "[]");
  
  // 隐藏已拉黑的卡片
  document.querySelectorAll(".card").forEach(card => {
    if (!card) return;
    
    const name = card.dataset.containerName;
    if (blacklisted.includes(name)) {
      card.style.display = "none";
    }
  });
  
  // 点击拉黑
  document.querySelectorAll(".blacklist-btn").forEach(btn => {
    if (!btn) return;
    
    btn.addEventListener("click", () => {
      const card = btn.closest(".card");
      if (!card) return;
      
      const name = card.dataset.containerName;
      if (!blacklisted.includes(name)) {
        blacklisted.push(name);
        localStorage.setItem("blacklisted_containers", JSON.stringify(blacklisted));
        showToast(`已将 ${name} 加入黑名单`);
      }
      card.style.display = "none";
    });
  });
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

// 显示提示消息
function showToast(msg, duration = 3000) {
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
