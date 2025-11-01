const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSites: () => ipcRenderer.invoke('get-sites'),
  refreshView: (id) => ipcRenderer.send('refresh-view', id),
  switchView: (id) => ipcRenderer.invoke('switch-view', id),
  addSite: (site)=>ipcRenderer.invoke('add-site', site),
});
