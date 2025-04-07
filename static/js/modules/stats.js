/**
 * 资源统计模块
 * 负责处理容器资源统计的显示和更新
 */

import { showToast } from './ui.js';

// 初始化资源统计控制
function initStatsControl() {
  const toggleBtn = document.getElementById("toggle-stats");
  if (!toggleBtn) return;
  
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

export { initStatsControl, loadContainerStats };
