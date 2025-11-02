const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSites: () => ipcRenderer.invoke('get-sites'),
  refreshView: (id) => ipcRenderer.send('refresh-view', id),
  switchView: (id) => ipcRenderer.invoke('switch-view', id),
  addSite: (site) => ipcRenderer.invoke('add-site', site),
  deleteSite: (id) => ipcRenderer.invoke('delete-site', id),
  on: (channel, callback) => {
    const validChannels = ['site-added', 'site-removed']; // 白名单，确保安全
    if (validChannels.includes(channel)) {
      // 包装 callback，只传递 args，不暴露 event 对象
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
});
