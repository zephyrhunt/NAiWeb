const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 请求 AI 网站列表
  getSites: () => ipcRenderer.invoke('get-sites'),
  refreshView: (id) => ipcRenderer.send('refresh-view', id), // 单向发送即可
  // 请求切换到某个 ID 的视图
  switchView: (id) => ipcRenderer.invoke('switch-view', id),
});