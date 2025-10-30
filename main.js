const { app, BrowserWindow, ipcMain, BrowserView, globalShortcut, Tray, Menu } = require('electron');
const path = require('path');

// main.js 文件中更新后的 AI_SITES 配置

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
    url: 'https://www.deepseek.com/chat',
  },
  {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    url: 'https://www.perplexity.ai',
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

// --- 2. 全局变量 ---
let mainWindow;
let tray;
const views = {}; // 存储所有 BrowserView

// --- 3. 关键修复：伪装 User-Agent (解决 Google 登录问题) ---
const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36';

// --- 4. 关键修复：处理 SSL 错误 ---
// 警告：这会降低安全性，但通常是解决企业代理/防火墙 SSL 问题的唯一方法
app.commandLine.appendSwitch('ignore-certificate-errors');

// --- 5. 防止应用多开 (对工具类应用很重要) ---
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
    show: true,          // 默认隐藏，等待快捷键调用
    skipTaskbar: true,    // 不在任务栏显示 (使其像个工具)
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // --- 关键：去掉原生菜单栏 ---
  mainWindow.setMenu(null);

  mainWindow.loadFile('index.html');

  // 窗口准备好后，创建所有的 BrowserView
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

    views[site.id] = view;

    // 默认隐藏 (通过移到后面)
    if (index !== 0) {
      mainWindow.removeBrowserView(view);
      mainWindow.addBrowserView(view);
    }
    // 监听视图中网页发出的创建新窗口请求 (通常是 Google 登录或外部链接)
    view.webContents.setWindowOpenHandler(({ url }) => {
      // 1. 如果是外部链接 (例如 Google 登录或广告)，使用系统浏览器打开
      if (url.startsWith('http') && !url.startsWith(site.url)) {
        shell.openExternal(url);
        
        // 阻止在 Electron 内部创建新窗口
        return { action: 'deny' }; 
      }
      
      // 2. 如果是当前 AI 网站内部的链接，允许在 BrowserView 内打开
      return { action: 'allow' };
    });
  });

  // 激活第一个
  if (AI_SITES.length > 0) {
    mainWindow.setTopBrowserView(views[AI_SITES[0].id]);
  }
}


// --- 6. 创建系统托盘 ---
function createTray() {
  // 注意：您需要自己在项目根目录放一个 'icon.png'
  const iconPath = path.join(__dirname, 'assets/icon.png'); 
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    { label: `显示/隐藏 (${HOTKEY})`, click: toggleWindow },
    { type: 'separator' },
    // --- 关键：只保留“退出”功能 ---
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

// --- 7. 窗口显示/隐藏逻辑 ---
function toggleWindow() {
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    showWindow();
  }
}

function showWindow() {
  // （可选）将窗口定位到屏幕中央
  // mainWindow.center(); 
  mainWindow.show();
  mainWindow.focus();
}

// --- IPC (这部分没有变化) ---
ipcMain.handle('get-sites', () => {
  return AI_SITES.map(site => ({ id: site.id, name: site.name }));
});
ipcMain.handle('switch-view', (event, id) => {
  const view = views[id];
  if (view) {
    // mainWindow.setTopBrowserView(view);
    for (const v of Object.values(views)) {
        mainWindow.removeBrowserView(v);
    }

    // 【Bug 修复点 2】: 重新添加选中的视图，使其独占窗口空间
    // 并将其自动置于最顶层
    mainWindow.addBrowserView(view);
    return { success: true };
  }
  return { success: false };
});


// --- App 生命周期 ---
app.whenReady().then(() => {
  createWindow();
  createTray();

  // --- 关键：注册全局快捷键 ---
  const ret = globalShortcut.register(HOTKEY, () => {
    toggleWindow();
  });

  if (!ret) {
    console.error('全局快捷键注册失败');
  }
});

app.on('will-quit', () => {
  // 注销所有快捷键
  globalShortcut.unregisterAll();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    showWindow();
  }
});

// (macOS) 保持应用在后台运行
app.on('window-all-closed', (e) => {
  if (process.platform === 'darwin') {
    e.preventDefault();
  }
});

ipcMain.on('refresh-view', (event, id) => {
    const view = views[id];
    if (view && view.webContents) {
        // 使用 webContents.reload() 来强制刷新 BrowserView 的内容
        view.webContents.reload(); 
    }
});