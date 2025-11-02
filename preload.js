const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSites: () => ipcRenderer.invoke('get-sites'),
  refreshView: (name) => ipcRenderer.send('refresh-view', name),
  switchView: (name) => ipcRenderer.invoke('switch-view', name),
  addSite: (site) => ipcRenderer.invoke('add-site', site),
  deleteSite: (name) => ipcRenderer.invoke('delete-site', name),
  on: (channel, callback) => {
    const validChannels = ['site-added', 'site-removed']; // 白名单，确保安全
    if (validChannels.includes(channel)) {
      // 包装 callback，只传递 args，不暴露 event 对象
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
});
