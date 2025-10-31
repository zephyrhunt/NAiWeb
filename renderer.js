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

  if (navBar.children.length > 0) {
    activeButton = navBar.children[0];
    activeButton.classList.add('active');
    window.api.switchView(activeButton.dataset.id);
  }
});