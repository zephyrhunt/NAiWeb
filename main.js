const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');

let mainWindow;
let port; // 在全局范围内保存串口实例

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools(); // 取消注释以打开开发者工具
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// --- 串口逻辑 ---

// 1. 扫描串口
ipcMain.handle('serial:scan', async () => {
  try {
    const ports = await SerialPort.list();
    return ports;
  } catch (err) {
    return { error: err.message };
  }
});

// 2. 连接串口
ipcMain.handle('serial:connect', async (event, path, baudRate) => {
  if (port && port.isOpen) {
    await port.close();
  }
  
  port = new SerialPort({ path, baudRate: parseInt(baudRate, 10) });

  return new Promise((resolve) => {
    port.on('open', () => {
      // 关键：监听数据
      port.on('data', (data) => {
        // 将数据 (Buffer) 发送到渲染进程
        mainWindow.webContents.send('serial:data', data);
      });
      resolve({ success: true });
    });

    port.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
});

// 3. 发送数据
ipcMain.on('serial:send', (event, data, format) => {
  if (port && port.isOpen) {
    if (format === 'hex') {
      // 转换 Hex 字符串为 Buffer
      const hexData = data.replace(/\s/g, ''); // 移除空格
      const buffer = Buffer.from(hexData, 'hex');
      port.write(buffer);
    } else {
      // 文本数据
      port.write(data);
    }
  }
});

// 4. 断开连接
ipcMain.handle('serial:disconnect', async () => {
  if (port && port.isOpen) {
    return new Promise((resolve) => {
      port.close((err) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          resolve({ success: true });
        }
      });
    });
  }
  return { success: true }; // 已经关闭了
});