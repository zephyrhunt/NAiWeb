const { app, BrowserWindow, ipcMain, BrowserView, globalShortcut, Tray, Menu,shell } = require('electron');
const path = require('path');

const AI_SITES = [
  {
    id: 'openai',
    name: 'ChatGPT',
    url: 'https://chat.openai.com',
  },
  {
    id: 'gemini',
    name: 'Gemini (Google)',
    // 使用 Google Gemini 网页版 URL
    url: 'https://gemini.google.com/app',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    // DeepSeek Chat 网页版 URL
    url: 'https://chat.deepseek.com',
  },
  {
    id: 'copilot',
    name: 'Copilot (Bing)',
    // Microsoft Copilot (原 Bing Chat) 网页版 URL
    url: 'https://copilot.microsoft.com',
  },
];
const NAV_BAR_HEIGHT = 50; // 顶部导航栏的高度
const HOTKEY = 'CmdOrCtrl+Shift+G'; // 您想要的全局快捷键

// 
let mainWindow;
let tray;
const views = {}; // 存储所有 BrowserView
const loadedStates = {};
const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36';
app.commandLine.appendSwitch('ignore-certificate-errors');
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
    width: 1200,
    height: 800,
    show: true, 
    skipTaskbar: true,  
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.setMenu(null);
  mainWindow.loadFile('index.html');
  mainWindow.webContents.on('did-finish-load', () => {
    createAIViews();
  });

  // 监听窗口大小变化，同步调整 BrowserView 的大小
  mainWindow.on('resize', () => {
    const [width, height] = mainWindow.getContentSize();
    for (const view of Object.values(views)) {
      view.setBounds({
        x: 0,
        y: NAV_BAR_HEIGHT,
        width: width, 
        height: height - NAV_BAR_HEIGHT 
      });
    }
  });

  // --- 关键：拦截关闭事件 ---
  // 点击窗口的 "x" 按钮时，不是退出，而是隐藏
  mainWindow.on('close', (event) => {
    // app.isQuitting 是我们在托盘菜单"退出"时设置的标志
    if (!app.isQuitting) {
      event.preventDefault(); // 阻止窗口关闭
      mainWindow.hide();      // 只是隐藏窗口
    }
  });

  // 失去焦点时自动隐藏 (如果您喜欢这个功能，可以取消注释)
  // mainWindow.on('blur', () => {
  //   if (mainWindow.isVisible()) {
  //     mainWindow.hide();
  //   }
  // });
}

// 创建所有的 AI BrowserView
function createAIViews() {
  const [width, height] = mainWindow.getContentSize();

  AI_SITES.forEach((site, index) => {
    const view = new BrowserView();
    mainWindow.addBrowserView(view);
    
    view.setBounds({ 
      x: 0, 
      y: NAV_BAR_HEIGHT, 
      width: width, 
      height: height - NAV_BAR_HEIGHT 
    });

    // --- 关键：在加载 URL 之前设置 User-Agent ---
    view.webContents.setUserAgent(CHROME_USER_AGENT);
    view.webContents.loadURL(site.url);
    views[site.id] = view
    loadedStates[site.id] = false

    view.webContents.on('did-finish-load', () => {
        // 标记为已加载，无论成功或失败 (确保不再触发强制刷新)
        loadedStates[site.id] = true; 
    });

    if (index !== 0) {
      mainWindow.removeBrowserView(view);
      mainWindow.addBrowserView(view);
    }
    // 解决外部链接问题，不一定有效
    view.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http') && !url.startsWith(site.url)) {
        shell.openExternal(url);
        return { action: 'deny' }; 
      }
      return { action: 'allow' };
    });
  });

  if (AI_SITES.length > 0) {
    const firstView = views[AI_SITES[0].id];
    mainWindow.addBrowserView(firstView); // <<-- 只添加第一个
    firstView.webContents.focus();        // <<-- 确保初始视图也获得焦点
    mainWindow.setTopBrowserView(views[AI_SITES[0].id]);
  }
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets/icon.png'); 
  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    { label: `显示/隐藏 (${HOTKEY})`, click: toggleWindow },
    { type: 'separator' },
    { label: '退出软件', click: () => {
        app.isQuitting = true; // 设置标志
        app.quit();          // 真正退出
      } 
    },
  ]);

  tray.setToolTip('NAiWeb');
  tray.setContextMenu(contextMenu);

  // 点击托盘图标也切换显示
  tray.on('click', toggleWindow);
}

/* 只有显示和focus才会隐藏 */
function toggleWindow() {
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide();
  } else {
    showWindow();
  }
}
function showWindow() {
  mainWindow.show();
  mainWindow.focus();
}

ipcMain.handle('get-sites', () => {
  return AI_SITES.map(site => ({ id: site.id, name: site.name }));
});
ipcMain.handle('switch-view', (event, id) => {
  const view = views[id];
  if (view) {
    for (const v of Object.values(views)) {
        mainWindow.removeBrowserView(v);
    }
    // view.webContents.focus()
    if (loadedStates[id] === false) {
        console.log(`首次切换到 ${id}，尝试强制刷新 (reloadIgnoringCache)。`);
        view.webContents.reloadIgnoringCache(); // 强制刷新 (忽略缓存)
    }
    // mainWindow.setTopBrowserView(view);
    mainWindow.addBrowserView(view);
    return { success: true };
  }
  return { success: false };
});


app.whenReady().then(() => {
  createWindow();
  createTray();

  const ret = globalShortcut.register(HOTKEY, () => {
    toggleWindow();
  });

  if (!ret) {
    console.error('全局快捷键注册失败');
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    showWindow();
  }
});

app.on('window-all-closed', (e) => {
  if (process.platform === 'darwin') {
    e.preventDefault();
  }
});

ipcMain.on('refresh-view', (event, id) => {
    const view = views[id];
    if (view && view.webContents) {
        console.log("refresh", id)
        view.webContents.reload(); 
    }
});