const { app, BrowserWindow, globalShortcut, Tray, Menu, screen } = require('electron');
const path = require('path');

// --- 可配置项 ---
// 您想加载的 AI 网站
const AI_URL = 'https://chat.openai.com'; 
// 您想使用的全局快捷键
// 'CmdOrCtrl' 在 Windows/Linux 上是 Ctrl，在 macOS 上是 Command
const HOTKEY = 'CmdOrCtrl+Shift+G'; 
// ---

let mainWindow;
let tray;

// 防止应用多开
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // 当第二个实例启动时，显示并聚焦第一个实例的窗口
    if (mainWindow) {
      showWindow();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,          // 默认隐藏
    frame: false,         // 无边框窗口
    resizable: false,     // 禁止调整大小
    skipTaskbar: true,    // 不在任务栏显示
    webPreferences: {
      // 在这里可以加载 preload 脚本，如果需要和网页交互
    },
  });

  // 加载您指定的 AI 网站
  mainWindow.loadURL(AI_URL);

  // 当窗口失去焦点时自动隐藏（核心功能）
  mainWindow.on('blur', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    }
  });
}

// 计算窗口位置（使其在屏幕中央顶部弹出）
function getWindowPosition() {
  const { width, height } = mainWindow.getBounds();
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  
  const x = Math.round((screenWidth - width) / 2);
  // 放在靠近顶部的位置
  const y = Math.round(screenHeight * 0.1); 

  return { x, y };
}

// 切换窗口显示/隐藏
function toggleWindow() {

  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    showWindow();
  }
}

// 显示窗口并将其置于前台
function showWindow() {
  const { x, y } = getWindowPosition();
  console.log("window", x, y)
  mainWindow.setPosition(x, y, false);
  mainWindow.show();
  mainWindow.focus();
}

// 创建系统托盘图标
function createTray() {
  // 确保您在 'assets' 文件夹下放了一个 'icon.png'
  const iconPath = path.join(__dirname, 'assets/icon.png'); 
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示/隐藏', click: toggleWindow },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);

  tray.setToolTip('AI 快速助手');
  tray.setContextMenu(contextMenu);
}

// --- 应用生命周期 ---

app.on('ready', () => {
  createWindow();
  createTray();

  // 注册全局快捷键
  const ret = globalShortcut.register(HOTKEY, () => {
    toggleWindow();
  });

  if (!ret) {
    console.error('全局快捷键注册失败');
  }
});

// 在应用退出前取消注册所有快捷键
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// （macOS）当所有窗口关闭时，应用通常不会退出
// 我们在这里也阻止它退出，让它驻留后台
app.on('window-all-closed', (e) => {
  e.preventDefault();
});

// （macOS）点击 Dock 图标时（虽然我们隐藏了它，但以防万一）
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    showWindow();
  }
});