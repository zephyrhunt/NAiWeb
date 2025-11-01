window.addEventListener('DOMContentLoaded', async () => {
  const navBar = document.getElementById('ai-nav-bar');
  let activeButton = null;

  const sites = await window.api.getSites();
  sites.forEach(site => {
    const button = document.createElement('button');
    button.textContent = site.name;
    button.classList.add('nav-button');
    button.dataset.id = site.id;
    button.addEventListener('click', () => {
      window.api.switchView(site.id);
      if (activeButton) {
        activeButton.classList.remove('active');
      }
      button.classList.add('active');
      activeButton = button;
    });
    navBar.appendChild(button);
  });

  // const refreshBtn = document.getElementById('refresh-btn');
  const refreshBtn = document.createElement('button');
  refreshBtn.textContent = '🔄'
  // 只添加icon-btn点击无用
  refreshBtn.classList.add('icon-btn');
  refreshBtn.classList.add('nav-button');
  refreshBtn.addEventListener('click', () => {
    if (activeButton) {
      refreshBtn.classList.add('spinning');
      refreshBtn.disabled = true;
      window.api.refreshView(activeButton.dataset.id);
      setTimeout(() => {
        refreshBtn.classList.remove('spinning');
        refreshBtn.disabled = false;
      }, 600);
    }
  });
  navBar.appendChild(refreshBtn);

  // 添加网站：点击 ➕ 打开 modal 子窗口（由主进程创建），主进程会在添加成功后通过 'site-added' 广播给此渲染进程
  const addBtn = document.createElement('button');
  addBtn.textContent = '➕'
  addBtn.classList.add('icon-btn');
  addBtn.classList.add('nav-button');
  addBtn.title = '待实现';

  addBtn.addEventListener('click', () => {
    // window.api.openAddWindow();
    window.api.switchView('add');
  });
  navBar.appendChild(addBtn);

  if (navBar.children.length > 0) {
    activeButton = navBar.children[0];
    activeButton.classList.add('active');
    window.api.switchView(activeButton.dataset.id);
  }
});