const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Main -> Renderer (单向)
  onSerialData: (callback) => ipcRenderer.on('serial:data', (event, data) => callback(data)),

  // Renderer -> Main (双向)
  scanPorts: () => ipcRenderer.invoke('serial:scan'),
  connectPort: (path, baudRate) => ipcRenderer.invoke('serial:connect', path, baudRate),
  disconnectPort: () => ipcRenderer.invoke('serial:disconnect'),

  // Renderer -> Main (单向)
  sendData: (data, format) => ipcRenderer.send('serial:send', data, format),
});