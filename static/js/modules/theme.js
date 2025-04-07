/**
 * 主题管理模块
 * 负责处理暗黑/明亮模式的切换和持久化
 */

// 初始化主题
function initTheme() {
  const theme = localStorage.getItem("theme");
  const darkBtn = document.getElementById("darkBtn");
  
  if (!darkBtn) return;
  
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

export { initTheme };
