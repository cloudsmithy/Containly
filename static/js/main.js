// 页面加载完成后执行
document.addEventListener("DOMContentLoaded", () => {
  // 初始化主题
  initTheme();
  
  // 初始化宿主机 IP
  initHostIP();
  
  // 初始化日志查看功能
  initLogViewer();
  
  // 初始化资源统计控制
  initStatsControl();
  
  // 初始化确认对话框
  initConfirmDialog();
  
  // 异步加载容器数据
  loadContainers();
  
  // 自动刷新功能已禁用
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
}

// 资源统计定时刷新 ID
let _statsIntervalId = null;

// 初始化资源统计控制
function initStatsControl() {
  const toggleBtn = document.getElementById("toggle-stats");
  const showStats = localStorage.getItem("show_stats") === "true";
  
  // 设置初始状态
  if (showStats) {
    document.body.classList.add("show-stats");
    toggleBtn.textContent = "隐藏资源统计";
    startStatsRefresh();
  }
  
  toggleBtn.addEventListener("click", () => {
    const isShowing = document.body.classList.toggle("show-stats");
    localStorage.setItem("show_stats", isShowing);
    toggleBtn.textContent = isShowing ? "隐藏资源统计" : "显示资源统计";
    
    if (isShowing) {
      loadContainerStats();
      startStatsRefresh();
    } else {
      stopStatsRefresh();
    }
  });
}

function startStatsRefresh() {
  stopStatsRefresh();
  _statsIntervalId = setInterval(loadContainerStats, 15000);
}

function stopStatsRefresh() {
  if (_statsIntervalId) {
    clearInterval(_statsIntervalId);
    _statsIntervalId = null;
  }
}

// 异步加载容器数据
function loadContainers() {
  // 显示加载指示器
  document.getElementById("main-loader").style.display = "flex";
  
  fetch("/api/containers/all")
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        // 渲染容器数据
        renderContainers(data.containers);
        
        // 隐藏加载指示器
        document.getElementById("main-loader").style.display = "none";
        
        // 初始化卡片事件
        initAllCardEvents();
        
        // 更新链接
        updateLinks();
        
        // 初始化黑名单功能
        initBlacklist();
        
        // 如果需要显示资源统计，则加载资源数据
        if (document.body.classList.contains("show-stats")) {
          loadContainerStats();
        }
      } else {
        showToast(`加载容器失败: ${data.error || '未知错误'}`);
      }
    })
    .catch(error => {
      showToast(`请求错误: ${error.message}`);
      document.getElementById("main-loader").style.display = "none";
    });
}

// 加载容器资源统计数据
function loadContainerStats() {
  fetch("/api/containers/stats")
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        // 更新资源统计数据
        updateContainerStats(data.stats);
      } else {
        showToast(`加载资源统计失败: ${data.error || '未知错误'}`);
      }
    })
    .catch(error => {
      showToast(`请求错误: ${error.message}`);
    });
}

// 更新容器资源统计数据
function updateContainerStats(stats) {
  for (const [containerId, containerStats] of Object.entries(stats)) {
    const card = document.querySelector(`.card[data-container-id="${containerId}"]`);
    if (!card) continue;
    
    const cpuBar = card.querySelector(".resource-usage .resource-bar:nth-of-type(1) .resource-fill");
    const cpuText = card.querySelector(".resource-usage .resource-text:nth-of-type(1)");
    const memoryBar = card.querySelector(".resource-usage .resource-bar:nth-of-type(2) .resource-fill");
    const memoryText = card.querySelector(".resource-usage .resource-text:nth-of-type(2)");
    
    if (cpuBar && cpuText) {
      cpuBar.style.width = `${containerStats.cpu_usage}%`;
      cpuText.textContent = `CPU: ${containerStats.cpu_usage}%`;
    }
    
    if (memoryBar && memoryText) {
      memoryBar.style.width = `${containerStats.memory_usage}%`;
      memoryText.textContent = `内存: ${containerStats.memory_usage}%`;
    }
  }
}

// 渲染容器数据
function renderContainers(containers) {
  console.log("渲染容器数据:", containers);
  
  // 清空现有容器
  document.getElementById("running-grid").innerHTML = "";
  document.getElementById("exited-grid").innerHTML = "";
  document.getElementById("paused-grid").innerHTML = "";
  document.getElementById("other-grid").innerHTML = "";
  
  // 渲染各状态的容器
  renderContainerGroup(containers.running, "running");
  renderContainerGroup(containers.exited, "exited");
  renderContainerGroup(containers.paused, "paused");
  renderContainerGroup(containers.other, "other");
}

// 渲染单个状态组的容器
function renderContainerGroup(containers, status) {
  const grid = document.getElementById(`${status}-grid`);
  
  if (!containers || containers.length === 0) {
    grid.innerHTML = `<div class="empty-state">暂无 ${status} 状态的容器</div>`;
    return;
  }
  
  // 清空现有内容
  grid.innerHTML = '';
  
  // 为每个状态组使用独立的索引计数器
  containers.forEach((container, index) => {
    console.log(`渲染 ${status} 容器: ${container.name}, 索引: ${index}`);
    const card = createContainerCard(container, status, index);
    grid.appendChild(card);
  });
}

// 创建容器卡片
function createContainerCard(container, status, index) {
  console.log("创建容器卡片:", container.name, container.status, "状态:", status, "索引:", index);
  
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.containerId = container.id;
  card.dataset.containerName = container.name;
  card.dataset.protocol = 'http';
  card.dataset.status = status;
  card.dataset.index = index % 6;
  
  // 设置卡片的颜色类
  card.classList.add(`${status}-card-${index % 6}`);
  
  let actionsHtml = '<div class="card-actions">';
  if (container.status === 'running') {
    actionsHtml += `
      <button class="action-btn stop-btn" data-id="${container.id}" title="停止容器">🛑</button>
      <button class="action-btn restart-btn" data-id="${container.id}" title="重启容器">🔄</button>
      <button class="action-btn logs-btn" data-id="${container.id}" title="查看日志">📋</button>
      <button class="action-btn terminal-btn" data-id="${container.id}" title="终端">💻</button>
    `;
  } else if (container.status === 'exited') {
    actionsHtml += `
      <button class="action-btn start-btn" data-id="${container.id}" title="启动容器">▶️</button>
      <button class="action-btn logs-btn" data-id="${container.id}" title="查看日志">📋</button>
    `;
  } else if (container.status === 'paused') {
    actionsHtml += `
      <button class="action-btn unpause-btn" data-id="${container.id}" title="恢复容器">▶️</button>
      <button class="action-btn logs-btn" data-id="${container.id}" title="查看日志">📋</button>
    `;
  }
  actionsHtml += `
    <button class="action-btn protocol-btn" title="切换协议">🔐</button>
    <button class="action-btn blacklist-btn" title="加入黑名单">🚫</button>
    <button class="action-btn delete-btn" data-id="${container.id}" title="删除容器">🗑️</button>
  </div>`;
  
  let resourcesHtml = '';
  if (container.status === 'running') {
    resourcesHtml = `
      <div class="resource-usage">
        <div class="resource-bar">
          <div class="resource-fill" style="width: ${container.cpu_usage}%"></div>
        </div>
        <div class="resource-text">CPU: ${container.cpu_usage}%</div>
        
        <div class="resource-bar">
          <div class="resource-fill" style="width: ${container.memory_usage}%"></div>
        </div>
        <div class="resource-text">内存: ${container.memory_usage}%</div>
      </div>
    `;
  }
  
  let portsHtml = '';
  if (container.ports && container.ports.length > 0) {
    container.ports.forEach(port => {
      portsHtml += `
        <div class="port-item" data-host="${port.host_port}" data-container="${port.container_port}">
          <div class="port-info">
            <span class="port-label">宿主机:</span> <span class="copyable host-port">${port.host_port}</span>
            <span class="port-divider">|</span>
            <span class="port-label">容器:</span> <span class="copyable container-port">${port.container_port}</span>
            <span class="status-indicator" title="检测中..."></span>
          </div>
          <div class="port-link-container">
            <a href="#" class="port-link" target="_blank"></a>
          </div>
        </div>
      `;
    });
  } else {
    portsHtml = '<div class="port-item">无端口映射</div>';
  }
  
  // 添加镜像信息
  const imageInfo = `
    <div class="image-info">
      <span class="image-label">镜像:</span> <span class="image-name">${container.image}</span>
    </div>
  `;
  
  card.innerHTML = `
    ${actionsHtml}
    <h3>${container.name}</h3>
    <div class="tag ${container.network === 'host' ? 'host' : ''}">${container.network}</div>
    ${imageInfo}
    ${resourcesHtml}
    <div class="port-list">
      ${portsHtml}
    </div>
  `;
  
  return card;
}

// 初始化所有卡片事件
function initAllCardEvents() {
  document.querySelectorAll(".card").forEach(card => {
    initCardEvents(card);
  });
}

// 初始化单个卡片的事件
function initCardEvents(card) {
  // 标记已初始化的事件，避免重复绑定 addEventListener
  if (!card._eventsInitialized) {
    initCardToggleActions(card);
    initProtocolToggle(card);
    initBlacklistButton(card);
    initCopyable(card);
    card._eventsInitialized = true;
  }

  // 这些用 onclick 赋值，可以安全重复调用
  initContainerActionButtons(card);

  // 延迟初始化端口检测
  setTimeout(() => {
    initPortCheck(card);
  }, 1000);
}

// 初始化卡片操作切换
function initCardToggleActions(card) {
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
}

// 通用容器操作请求（带防重复点击）
function containerAction(url, method, card, loadingMsg, onSuccess, onError) {
  if (card._actionInProgress) return;
  card._actionInProgress = true;
  addLoadingOverlay(card, loadingMsg);
  fetch(url, { method })
    .then(response => {
      if (!response.ok) throw new Error(`操作失败: ${response.status}`);
      return response.json();
    })
    .then(data => {
      if (data.success) {
        onSuccess(data);
      } else {
        removeLoadingOverlay(card);
        card._actionInProgress = false;
        showToast(`失败: ${data.error || '未知错误'}`);
      }
    })
    .catch(error => {
      removeLoadingOverlay(card);
      card._actionInProgress = false;
      showToast(`请求错误: ${error.message}`);
      if (onError) onError(error);
    });
}

// 初始化容器操作按钮
function initContainerActionButtons(card) {
  // 启动按钮
  const startBtn = card.querySelector(".start-btn");
  if (startBtn) {
    startBtn.onclick = (e) => {
      e.stopPropagation();
      containerAction(`/api/start/${startBtn.dataset.id}`, 'POST', card, "正在启动容器...", () => {
        card.classList.add("card-moving");
        setTimeout(() => moveCardToSection(card, "running"), 500);
      });
    };
  }

  // 停止按钮
  const stopBtn = card.querySelector(".stop-btn");
  if (stopBtn) {
    stopBtn.onclick = (e) => {
      e.stopPropagation();
      containerAction(`/api/stop/${stopBtn.dataset.id}`, 'POST', card, "正在停止容器...", () => {
        card.classList.add("card-moving");
        setTimeout(() => moveCardToSection(card, "exited"), 500);
      });
    };
  }

  // 重启按钮
  const restartBtn = card.querySelector(".restart-btn");
  if (restartBtn) {
    restartBtn.onclick = (e) => {
      e.stopPropagation();
      containerAction(`/api/restart/${restartBtn.dataset.id}`, 'POST', card, "正在重启容器...", () => {
        setTimeout(() => loadContainers(), 1000);
      });
    };
  }

  // 恢复（unpause）按钮
  const unpauseBtn = card.querySelector(".unpause-btn");
  if (unpauseBtn) {
    unpauseBtn.onclick = (e) => {
      e.stopPropagation();
      containerAction(`/api/unpause/${unpauseBtn.dataset.id}`, 'POST', card, "正在恢复容器...", () => {
        card.classList.add("card-moving");
        setTimeout(() => moveCardToSection(card, "running"), 500);
      });
    };
  }

  // 日志按钮
  const logsBtn = card.querySelector(".logs-btn");
  if (logsBtn) {
    logsBtn.onclick = (e) => {
      e.stopPropagation();
      const containerId = logsBtn.dataset.id;
      if (!containerId) return;

      const logViewer = document.querySelector(".log-viewer");
      const logContent = document.querySelector(".log-content");
      const logName = document.getElementById("log-container-name");
      if (!logViewer || !logContent) return;

      if (logName) logName.textContent = card.dataset.containerName || '';

      // 存储当前查看的容器 ID，供刷新使用
      logViewer.dataset.containerId = containerId;

      logContent.innerHTML = '<div class="loader"></div> 加载中...';
      logViewer.classList.add("active");

      fetchLogs(containerId, logContent);
    };
  }

  // 终端按钮
  const terminalBtn = card.querySelector(".terminal-btn");
  if (terminalBtn) {
    terminalBtn.onclick = (e) => {
      e.stopPropagation();
      const containerId = terminalBtn.dataset.id;
      if (containerId) window.open(`/terminal/${containerId}`, '_blank');
    };
  }

  // 删除容器按钮
  const deleteBtn = card.querySelector(".delete-btn");
  if (deleteBtn) {
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      const containerId = deleteBtn.dataset.id;
      const containerName = card.dataset.containerName;

      showConfirmDialog(`确定要删除容器 ${containerName} 吗？`, () => {
        containerAction(`/api/delete/container/${containerId}?force=true`, 'DELETE', card, "正在删除容器...", () => {
          card.classList.add("card-fading");
          setTimeout(() => {
            card.remove();
            const status = card.dataset.status;
            const grid = document.getElementById(`${status}-grid`);
            if (grid && grid.children.length === 0) {
              grid.innerHTML = `<div class="empty-state">暂无 ${status} 状态的容器</div>`;
            }
          }, 500);
          showToast("容器删除成功");
        });
      });
    };
  }
}

// 初始化协议切换
function initProtocolToggle(card) {
  const containerName = card.dataset.containerName;
  const btn = card.querySelector(".protocol-btn");
  if (!btn) return;
  
  // 加载保存的协议状态
  const storedProtocol = localStorage.getItem(`protocol_${containerName}`) || "http";
  card.dataset.protocol = storedProtocol;
  btn.textContent = storedProtocol === "http" ? "🔐" : "🔓";
  btn.title = storedProtocol === "http" ? "切换到HTTPS" : "切换到HTTP";
  
  btn.addEventListener("click", () => {
    const current = card.dataset.protocol;
    const newProtocol = current === "http" ? "https" : "http";
    card.dataset.protocol = newProtocol;
    btn.textContent = newProtocol === "http" ? "🔐" : "🔓";
    btn.title = newProtocol === "http" ? "切换到HTTPS" : "切换到HTTP";
    
    // 保存到 localStorage
    localStorage.setItem(`protocol_${containerName}`, newProtocol);
    
    updateLinks();
  });
}

// 初始化黑名单按钮
function initBlacklistButton(card) {
  const blacklistBtn = card.querySelector(".blacklist-btn");
  if (!blacklistBtn) return;
  
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
function initCopyable(card) {
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
}

// 初始化端口检测（通过后端 API 检测）
function initPortCheck(card) {
  const hostIP = document.getElementById("host-ip").value || "localhost";

  card.querySelectorAll(".port-item").forEach(item => {
    const hostPort = item.dataset.host;
    if (!hostPort) return;

    const indicator = item.querySelector(".status-indicator");
    if (!indicator) return;

    fetch(`/api/check-port?host=${encodeURIComponent(hostIP)}&port=${hostPort}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.reachable) {
          indicator.classList.add("open");
          indicator.classList.remove("closed");
          indicator.title = "可访问";
        } else {
          indicator.classList.add("closed");
          indicator.classList.remove("open");
          indicator.title = "不可访问";
        }
      })
      .catch(() => {
        indicator.classList.add("closed");
        indicator.classList.remove("open");
        indicator.title = "检测失败";
      });
  });
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
    const url = `${protocol}://${hostIP}:${hostPort}`;
    link.href = url;
    link.innerHTML = `<i class="fas fa-external-link-alt"></i> ${url}`;
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
  const targetGrid = document.getElementById(`${targetStatus}-grid`);
  if (!targetGrid) {
    loadContainers();
    return;
  }

  const currentSection = card.closest('.section');
  if (!currentSection) {
    loadContainers();
    return;
  }

  const currentStatus = currentSection.dataset.status;
  const sourceGrid = document.getElementById(`${currentStatus}-grid`);
  const index = parseInt(card.dataset.index || "0");

  // 直接移动 DOM 节点（appendChild 会自动从原位置移除）
  const emptyState = targetGrid.querySelector(".empty-state");
  if (emptyState) emptyState.remove();

  // 更新卡片状态和颜色类
  card.dataset.status = targetStatus;
  ['running', 'exited', 'paused', 'other'].forEach(s => {
    for (let i = 0; i < 6; i++) card.classList.remove(`${s}-card-${i}`);
  });
  card.classList.add(`${targetStatus}-card-${index}`);

  targetGrid.appendChild(card);

  // 检查原分组是否为空
  if (sourceGrid && sourceGrid.children.length === 0) {
    sourceGrid.innerHTML = `<div class="empty-state">暂无 ${currentStatus} 状态的容器</div>`;
  }

  removeLoadingOverlay(card);
  card.classList.remove("card-moving");
  updateCardForNewStatus(card, targetStatus);
  initCardEvents(card);
}

// 更新卡片内容以反映新状态
function updateCardForNewStatus(card, newStatus) {
  const actionsDiv = card.querySelector(".card-actions");
  const containerId = card.dataset.containerId;
  
  console.log(`更新卡片状态: ${card.dataset.containerName} 到 ${newStatus}`);
  
  // 清空操作按钮
  actionsDiv.innerHTML = '';
  
  // 公共按钮
  const commonBtns = `
    <button class="action-btn protocol-btn" title="切换协议">🔐</button>
    <button class="action-btn blacklist-btn" title="加入黑名单">🚫</button>
    <button class="action-btn delete-btn" data-id="${containerId}" title="删除容器">🗑️</button>
  `;

  // 根据新状态添加适当的按钮
  if (newStatus === "running") {
    actionsDiv.innerHTML = `
      <button class="action-btn stop-btn" data-id="${containerId}" title="停止容器">🛑</button>
      <button class="action-btn restart-btn" data-id="${containerId}" title="重启容器">🔄</button>
      <button class="action-btn logs-btn" data-id="${containerId}" title="查看日志">📋</button>
      <button class="action-btn terminal-btn" data-id="${containerId}" title="终端">💻</button>
      ${commonBtns}
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
      if (tag) {
        tag.parentNode.insertBefore(resourceUsage, tag.nextSibling);
      }
    }
  } else if (newStatus === "exited") {
    actionsDiv.innerHTML = `
      <button class="action-btn start-btn" data-id="${containerId}" title="启动容器">▶️</button>
      <button class="action-btn logs-btn" data-id="${containerId}" title="查看日志">📋</button>
      ${commonBtns}
    `;
    
    // 移除资源使用情况
    const resourceUsage = card.querySelector(".resource-usage");
    if (resourceUsage) {
      resourceUsage.remove();
    }
  }
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
}

// 获取容器日志
function fetchLogs(containerId, logContent) {
  fetch(`/api/logs/${containerId}`)
    .then(response => response.text())
    .then(logs => { logContent.textContent = logs; logContent.scrollTop = logContent.scrollHeight; })
    .catch(error => { logContent.textContent = `获取日志失败: ${error.message}`; });
}

// 初始化日志查看功能
function initLogViewer() {
  const logViewer = document.querySelector(".log-viewer");
  const closeBtn = document.querySelector(".log-close");
  const refreshBtn = document.getElementById("log-refresh");

  if (!logViewer || !closeBtn) return;

  closeBtn.addEventListener("click", () => {
    logViewer.classList.remove("active");
  });

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      const containerId = logViewer.dataset.containerId;
      const logContent = document.querySelector(".log-content");
      if (containerId && logContent) {
        logContent.innerHTML = '<div class="loader"></div> 刷新中...';
        fetchLogs(containerId, logContent);
      }
    });
  }
  
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
// 确认对话框回调（闭包，避免全局泄漏）
let _confirmCallback = null;

// 初始化确认对话框
function initConfirmDialog() {
  const dialog = document.getElementById("confirm-dialog");
  const cancelBtn = document.getElementById("confirm-cancel");
  const okBtn = document.getElementById("confirm-ok");

  if (!dialog || !cancelBtn || !okBtn) return;

  const closeDialog = () => {
    dialog.classList.remove("active");
    _confirmCallback = null;
  };

  cancelBtn.addEventListener("click", closeDialog);

  okBtn.addEventListener("click", () => {
    dialog.classList.remove("active");
    if (_confirmCallback) _confirmCallback();
    _confirmCallback = null;
  });

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) closeDialog();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dialog.classList.contains("active")) closeDialog();
  });
}

// 显示确认对话框
function showConfirmDialog(message, callback) {
  const dialog = document.getElementById("confirm-dialog");
  const messageEl = document.getElementById("confirm-message");
  if (!dialog || !messageEl) return;

  messageEl.textContent = message;
  _confirmCallback = callback;
  dialog.classList.add("active");
}
