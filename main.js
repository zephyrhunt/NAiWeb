const { app, BrowserWindow, ipcMain, BrowserView, globalShortcut, Tray, Menu,shell } = require('electron');
const path = require('path');

const ai_sites = [
  {
    id: 'openai',
    name: 'ChatGPT',
    url: 'https://chat.openai.com',
  },
  {
    id: 'gemini',
    name: 'Gemini (Google)',
    url: 'https://gemini.google.com/app',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
  },
  {
    id: 'copilot',
    name: 'Copilot (Bing)',
    url: 'https://copilot.microsoft.com',
  },
];
const nav_bar_height = 50; // 顶部导航栏的高度
const hot_key = 'CmdOrCtrl+Shift+G'; // 您想要的全局快捷键

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
    experimentalFeatures: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
  });

  mainWindow.setMenu(null);
  mainWindow.loadFile('index.html');
  mainWindow.webContents.on('did-finish-load', () => {
    createAIViews();
  });

  mainWindow.webContents.on('certificate-error', (event, url, error, certificate, callback) => {
    event.preventDefault()
    callback(true)
  })

    // 设置权限请求处理器
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    // 允许常见的权限请求
    const allowedPermissions = ['notifications', 'clipboard-read', 'clipboard-write'];
    callback(allowedPermissions.includes(permission));
  })

  // 监听窗口大小变化，同步调整 BrowserView 的大小
  mainWindow.on('resize', () => {
    const [width, height] = mainWindow.getContentSize();
    for (const view of Object.values(views)) {
      view.setBounds({
        x: 0,
        y: nav_bar_height,
        width: width, 
        height: height - nav_bar_height 
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

  ai_sites.forEach((site, index) => {
    // const view = new BrowserView();
    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        // 为每个 BrowserView 启用实验性功能
        experimentalFeatures: true
      }
    });
    mainWindow.addBrowserView(view);
    
    view.setBounds({ 
      x: 0, 
      y: nav_bar_height, 
      width: width, 
      height: height - nav_bar_height 
    });

    // --- 关键：在加载 URL 之前设置 User-Agent ---
    const agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:70.0) Gecko/20100101 Firefox/70.0"
    view.webContents.setUserAgent(agent);
     // 为每个 BrowserView 单独处理证书错误
    view.webContents.on('certificate-error', (event, url, error, certificate, callback) => {
      event.preventDefault();
      callback(true);
    });
      // 设置权限请求处理器
    view.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowedPermissions = ['notifications', 'clipboard-read', 'clipboard-write'];
      callback(allowedPermissions.includes(permission));
    });
    view.webContents.loadURL(site.url);
    views[site.id] = view
    loadedStates[site.id] = false

    view.webContents.on('did-finish-load', () => {
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

  if (ai_sites.length > 0) {
    const firstView = views[ai_sites[0].id];
    
    mainWindow.addBrowserView(firstView); // <<-- 只添加第一个
    firstView.webContents.focus();        // <<-- 确保初始视图也获得焦点
    mainWindow.setTopBrowserView(views[ai_sites[0].id]);
  }
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets/icon.png'); 
  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    { label: `显示/隐藏 (${hot_key})`, click: toggleWindow },
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
  return ai_sites.map(site => ({ id: site.id, name: site.name }));
});
ipcMain.handle('switch-view', (event, id) => {
  const view = views[id];
  if (view) {
    for (const v of Object.values(views)) {
        mainWindow.removeBrowserView(v);
    }
    // view.webContents.focus()
    if (loadedStates[id] === false) {
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

  const ret = globalShortcut.register(hot_key, () => {
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