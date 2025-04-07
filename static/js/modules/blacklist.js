/**
 * 黑名单管理模块
 * 负责处理容器黑名单的添加和移除
 */

import { showToast } from './ui.js';

// 初始化黑名单功能
function initBlacklist() {
  const blacklisted = getBlacklistedContainers();
  
  // 隐藏已拉黑的卡片
  document.querySelectorAll(".card").forEach(card => {
    if (!card) return;
    
    const name = card.dataset.containerName;
    if (blacklisted.includes(name)) {
      card.style.display = "none";
    }
  });
}

// 初始化黑名单按钮
function initBlacklistButton(card) {
  const blacklistBtn = card.querySelector(".blacklist-btn");
  if (!blacklistBtn) return;
  
  blacklistBtn.addEventListener("click", () => {
    const name = card.dataset.containerName;
    if (!name) return;
    
    addToBlacklist(name);
    card.style.display = "none";
  });
}

// 添加容器到黑名单
function addToBlacklist(containerName) {
  const blacklisted = getBlacklistedContainers();
  if (!blacklisted.includes(containerName)) {
    blacklisted.push(containerName);
    localStorage.setItem("blacklisted_containers", JSON.stringify(blacklisted));
    showToast(`已将 ${containerName} 加入黑名单`);
  }
}

// 从黑名单移除容器
function removeFromBlacklist(containerName) {
  const blacklisted = getBlacklistedContainers();
  const index = blacklisted.indexOf(containerName);
  
  if (index !== -1) {
    blacklisted.splice(index, 1);
    localStorage.setItem("blacklisted_containers", JSON.stringify(blacklisted));
    return true;
  }
  return false;
}

// 获取黑名单容器列表
function getBlacklistedContainers() {
  return JSON.parse(localStorage.getItem("blacklisted_containers") || "[]");
}

// 清空黑名单
function clearBlacklist() {
  localStorage.setItem("blacklisted_containers", "[]");
}

export { 
  initBlacklist, 
  initBlacklistButton, 
  addToBlacklist, 
  removeFromBlacklist,
  getBlacklistedContainers,
  clearBlacklist
};
