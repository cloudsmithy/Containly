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

// 初始化资源统计控制
function initStatsControl() {
  const toggleBtn = document.getElementById("toggle-stats");
  const showStats = localStorage.getItem("show_stats") === "true";
  
  // 设置初始状态
  if (showStats) {
    document.body.classList.add("show-stats");
    toggleBtn.textContent = "隐藏资源统计";
  }
  
  toggleBtn.addEventListener("click", () => {
    const isShowing = document.body.classList.toggle("show-stats");
    localStorage.setItem("show_stats", isShowing);
    toggleBtn.textContent = isShowing ? "隐藏资源统计" : "显示资源统计";
    
    // 如果显示资源统计，则加载资源数据
    if (isShowing) {
      loadContainerStats();
    }
  });
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
    
    const cpuBar = card.querySelector(".resource-usage .resource-bar:first-child .resource-fill");
    const cpuText = card.querySelector(".resource-usage .resource-text:first-child");
    const memoryBar = card.querySelector(".resource-usage .resource-bar:last-child .resource-fill");
    const memoryText = card.querySelector(".resource-usage .resource-text:last-child");
    
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
    grid.innerHTML = `<div class="empty-state">没有${status}状态的容器</div>`;
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
  // 初始化卡片操作切换
  initCardToggleActions(card);
  
  // 初始化容器操作按钮
  initContainerActionButtons(card);
  
  // 初始化协议切换按钮
  initProtocolToggle(card);
  
  // 初始化黑名单按钮
  initBlacklistButton(card);
  
  // 初始化复制功能
  initCopyable(card);
  
  // 延迟初始化端口检测，减少页面加载时的负担
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

// 初始化容器操作按钮
function initContainerActionButtons(card) {
  // 启动按钮
  const startBtn = card.querySelector(".start-btn");
  if (startBtn) {
    startBtn.onclick = (e) => {
      e.stopPropagation(); // 阻止事件冒泡
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
            console.log("容器启动成功，准备移动卡片");
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
          console.error("启动容器错误:", error);
        });
    };
  }
  
  // 停止按钮
  const stopBtn = card.querySelector(".stop-btn");
  if (stopBtn) {
    stopBtn.onclick = (e) => {
      e.stopPropagation(); // 阻止事件冒泡
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
            console.log("容器停止成功，准备移动卡片");
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
          console.error("停止容器错误:", error);
        });
    };
  }
  
  // 重启按钮
  const restartBtn = card.querySelector(".restart-btn");
  if (restartBtn) {
    restartBtn.onclick = (e) => {
      e.stopPropagation(); // 阻止事件冒泡
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
            // 由于重启后状态不变，只需刷新容器数据
            setTimeout(() => {
              loadContainers();
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
          console.error("重启容器错误:", error);
        });
    };
  }
  
  // 日志按钮
  const logsBtn = card.querySelector(".logs-btn");
  if (logsBtn) {
    logsBtn.onclick = (e) => {
      e.stopPropagation(); // 阻止事件冒泡
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
          console.error("获取日志错误:", error);
        });
    };
  }
  
  // 终端按钮
  const terminalBtn = card.querySelector(".terminal-btn");
  if (terminalBtn) {
    terminalBtn.onclick = (e) => {
      e.stopPropagation(); // 阻止事件冒泡
      const containerId = terminalBtn.dataset.id;
      if (!containerId) return;
      
      // 跳转到终端页面
      window.open(`/terminal/${containerId}`, '_blank');
    };
  }
  
  // 删除容器按钮
  const deleteBtn = card.querySelector(".delete-btn");
  if (deleteBtn) {
    deleteBtn.onclick = (e) => {
      e.stopPropagation(); // 阻止事件冒泡
      const containerId = deleteBtn.dataset.id;
      const containerName = card.dataset.containerName;
      
      // 显示确认对话框
      showConfirmDialog(
        `确定要删除容器 ${containerName} 吗？`,
        () => {
          // 添加加载特效
          addLoadingOverlay(card, "正在删除容器...");
          
          // 发送删除请求
          fetch(`/api/delete/container/${containerId}?force=true`)
            .then(response => {
              if (!response.ok) {
                throw new Error(`操作失败: ${response.status}`);
              }
              return response.json();
            })
            .then(data => {
              if (data.success) {
                // 添加淡出动画
                card.classList.add("card-fading");
                
                // 延迟后移除卡片
                setTimeout(() => {
                  card.remove();
                  
                  // 检查分组是否为空
                  const status = card.dataset.status;
                  const grid = document.getElementById(`${status}-grid`);
                  if (grid && grid.children.length === 0) {
                    grid.innerHTML = `<div class="empty-state">没有${status}状态的容器</div>`;
                  }
                }, 500);
                
                showToast("容器删除成功");
              } else {
                // 移除加载特效
                removeLoadingOverlay(card);
                showToast(`删除失败: ${data.error || '未知错误'}`);
              }
            })
            .catch(error => {
              // 移除加载特效
              removeLoadingOverlay(card);
              showToast(`请求错误: ${error.message}`);
              console.error("删除容器错误:", error);
            });
        }
      );
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

// 初始化端口检测
function initPortCheck(card) {
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
  // 获取目标分组
  const targetGrid = document.getElementById(`${targetStatus}-grid`);
  if (!targetGrid) {
    console.error(`找不到目标分组: ${targetStatus}-grid`);
    // 如果找不到目标分组，刷新容器数据
    loadContainers();
    return;
  }
  
  // 获取当前分组
  const currentSection = card.closest('.section');
  if (!currentSection) {
    console.error('找不到当前分组');
    loadContainers();
    return;
  }
  
  const currentStatus = currentSection.dataset.status;
  const sourceGrid = document.getElementById(`${currentStatus}-grid`);
  
  // 获取容器ID和名称
  const containerId = card.dataset.containerId;
  const containerName = card.dataset.containerName;
  const index = parseInt(card.dataset.index || "0"); // 保留索引
  
  console.log(`移动容器: ${containerName} (${containerId}) 从 ${currentStatus} 到 ${targetStatus}, 索引: ${index}`);
  
  // 克隆卡片以保留其数据
  const clonedCard = card.cloneNode(true);
  
  // 移除原卡片
  card.remove();
  
  // 检查原分组是否为空
  if (sourceGrid && sourceGrid.children.length === 0) {
    sourceGrid.innerHTML = `<div class="empty-state">没有${currentStatus}状态的容器</div>`;
  }
  
  // 检查目标分组是否有空状态提示
  const emptyState = targetGrid.querySelector(".empty-state");
  if (emptyState) {
    emptyState.remove();
  }
  
  // 更新卡片的状态和类名
  clonedCard.dataset.status = targetStatus;
  
  // 移除所有颜色类
  clonedCard.classList.remove(
    'running-card-0', 'running-card-1', 'running-card-2', 'running-card-3', 'running-card-4', 'running-card-5',
    'exited-card-0', 'exited-card-1', 'exited-card-2', 'exited-card-3', 'exited-card-4', 'exited-card-5',
    'paused-card-0', 'paused-card-1', 'paused-card-2', 'paused-card-3', 'paused-card-4', 'paused-card-5',
    'other-card-0', 'other-card-1', 'other-card-2', 'other-card-3', 'other-card-4', 'other-card-5'
  );
  
  // 添加新的颜色类
  clonedCard.classList.add(`${targetStatus}-card-${index}`);
  
  // 添加到目标分组
  targetGrid.appendChild(clonedCard);
  
  // 移除加载特效和移动动画类
  removeLoadingOverlay(clonedCard);
  clonedCard.classList.remove("card-moving");
  
  // 更新卡片内容以反映新状态
  updateCardForNewStatus(clonedCard, targetStatus);
  
  // 重新初始化卡片事件
  initCardEvents(clonedCard);
  
  console.log(`容器移动完成: ${containerName} 现在在 ${targetStatus} 分组`);
}

// 更新卡片内容以反映新状态
function updateCardForNewStatus(card, newStatus) {
  const actionsDiv = card.querySelector(".card-actions");
  const containerId = card.dataset.containerId;
  
  console.log(`更新卡片状态: ${card.dataset.containerName} 到 ${newStatus}`);
  
  // 清空操作按钮
  actionsDiv.innerHTML = '';
  
  // 根据新状态添加适当的按钮
  if (newStatus === "running") {
    actionsDiv.innerHTML = `
      <button class="action-btn stop-btn" data-id="${containerId}" title="停止容器">🛑</button>
      <button class="action-btn restart-btn" data-id="${containerId}" title="重启容器">🔄</button>
      <button class="action-btn logs-btn" data-id="${containerId}" title="查看日志">📋</button>
      <button class="action-btn terminal-btn" data-id="${containerId}" title="终端">💻</button>
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
      if (tag) {
        tag.parentNode.insertBefore(resourceUsage, tag.nextSibling);
      } else {
        console.error("找不到标签元素");
      }
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
// 初始化确认对话框
function initConfirmDialog() {
  const dialog = document.getElementById("confirm-dialog");
  const cancelBtn = document.getElementById("confirm-cancel");
  const okBtn = document.getElementById("confirm-ok");
  
  if (!dialog || !cancelBtn || !okBtn) return;
  
  // 取消按钮
  cancelBtn.addEventListener("click", () => {
    dialog.classList.remove("active");
    // 清除确认回调
    dialog.dataset.confirmCallback = "";
  });
  
  // 确认按钮
  okBtn.addEventListener("click", () => {
    dialog.classList.remove("active");
    
    // 执行确认回调
    const callbackName = dialog.dataset.confirmCallback;
    if (callbackName && window[callbackName]) {
      window[callbackName]();
    }
    
    // 清除确认回调
    dialog.dataset.confirmCallback = "";
  });
  
  // 点击背景关闭
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      dialog.classList.remove("active");
      // 清除确认回调
      dialog.dataset.confirmCallback = "";
    }
  });
  
  // ESC 键关闭
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dialog.classList.contains("active")) {
      dialog.classList.remove("active");
      // 清除确认回调
      dialog.dataset.confirmCallback = "";
    }
  });
}

// 显示确认对话框
function showConfirmDialog(message, callback) {
  const dialog = document.getElementById("confirm-dialog");
  const messageEl = document.getElementById("confirm-message");
  
  if (!dialog || !messageEl) return;
  
  // 设置消息
  messageEl.textContent = message;
  
  // 创建一个唯一的回调函数名
  const callbackName = `confirmCallback_${Date.now()}`;
  
  // 将回调函数添加到全局作用域
  window[callbackName] = callback;
  
  // 存储回调函数名
  dialog.dataset.confirmCallback = callbackName;
  
  // 显示对话框
  dialog.classList.add("active");
}
