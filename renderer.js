window.addEventListener('DOMContentLoaded', async () => {
  const navBar = document.getElementById('ai-nav-bar');
  let activeButton = null;

  // 1. 从主进程获取 AI 网站列表
  const sites = await window.api.getSites();
  if (!sites || sites.length === 0) {
    navBar.textContent = '请在 main.js 中配置 AI_SITES';
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
    const refreshBtn = document.getElementById('refresh-btn');

    // ... 原有的 sites.forEach 循环和按钮创建逻辑不变 ...

    // 1. 监听刷新按钮点击事件
    refreshBtn.addEventListener('click', () => {
      // 通知主进程刷新当前激活的 BrowserView
      if (activeButton) {
        // 【新增】调用 API 通知主进程刷新
        window.api.refreshView(activeButton.dataset.id);
      }
    });
  });

  // 4. 默认激活第一个按钮
  if (navBar.children.length > 0) {
    activeButton = navBar.children[0];
    activeButton.classList.add('active');
    // (主进程已经默认显示第一个了)
  }
});