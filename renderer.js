const navBar = document.getElementById('ai-nav-bar');
let activeButton = null;
function mouseCallBack(newSite, button) {
  return async (mouse) => {
    switch (mouse.button) {
      case 0:
        window.api.switchView(newSite.name);
        if (activeButton) {
          activeButton.classList.remove('active');
        }
        button.classList.add('active');
        activeButton = button;
        break;
      case 1:
      case 2:
        window.api.deleteSite(newSite.name)
        navBar.removeChild(button)
    }
  }
}
window.addEventListener('DOMContentLoaded', async () => {
  const refreshBtn = document.createElement('button');
  refreshBtn.textContent = '🔄'
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

  const addBtn = document.createElement('button');
  addBtn.textContent = '➕'
  addBtn.classList.add('icon-btn');
  addBtn.classList.add('nav-button');
  addBtn.title = '添加新的站点';

  addBtn.addEventListener('mousedown', () => {
    // window.api.openAddWindow();
    window.api.switchView('add');
  });
  navBar.appendChild(addBtn);

  const sites = await window.api.getSites();
  sites.forEach(site => {
    const button = document.createElement('button');
    button.textContent = site.name;
    button.classList.add('nav-button');
    button.dataset.id = site.name;
    const handler = mouseCallBack(site, button)
    button.addEventListener('mousedown', handler)
    navBar.appendChild(button);
  });
  /* 创建完成后切换 */
  if (navBar.children.length > 0) {
    activeButton = navBar.children[2];
    activeButton.classList.add('active');
    window.api.switchView(activeButton.dataset.id);
  }
});

window.api.on('site-added', (newSite) => {
  let button = document.createElement('button');
  button.textContent = newSite.name;
  button.classList.add('nav-button');
  button.dataset.id = newSite.name;
  const handler = mouseCallBack(newSite, button)
  button.addEventListener('mousedown', handler)
  navBar.appendChild(button);
  if (navBar.children.length === 1) {
    activeButton = button;
    activeButton.classList.add('active');
    window.api.switchView(activeButton.dataset.id);
  }
});
