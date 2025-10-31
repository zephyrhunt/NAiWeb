window.addEventListener('DOMContentLoaded', async () => {
  const navBar = document.getElementById('ai-nav-bar');
  let activeButton = null;

  // 1. 从主进程获取 AI 网站列表
  const sites = await window.api.getSites();
  if (!sites || sites.length === 0) {
    navBar.textContent = '请在 main.js 中配置 ai_sites';
    return;
  }

  // 2. 为每个网站创建按钮
  sites.forEach(site => {
    const button = document.createElement('button');
    button.textContent = site.name;
    button.classList.add('nav-button');
    button.dataset.id = site.id; // 存储 ID

    // 3. 添加点击事件
    button.addEventListener('click', () => {
      // 告诉主进程切换视图
      window.api.switchView(site.id);

      // 更新 UI 上的激活状态
      if (activeButton) {
        activeButton.classList.remove('active');
      }
      button.classList.add('active');
      activeButton = button;
    });

    navBar.appendChild(button);
  });

    const refreshBtn = document.getElementById('refresh-btn');

    refreshBtn.addEventListener('click', () => {
      if (activeButton) {
        window.api.refreshView(activeButton.dataset.id);
      }
    });
  if (navBar.children.length > 0) {
    activeButton = navBar.children[2]; // 0是刷新按钮，1不知是什么
    activeButton.classList.add('active');
    window.api.switchView(activeButton.dataset.id);
  }
});