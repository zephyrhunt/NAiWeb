const { app, BrowserWindow, ipcMain, BrowserView, globalShortcut, Tray, Menu,shell } = require('electron');
const path = require('path');

const fs = require('fs');
const aiSites = (() => {
  try {
    const configPath = path.join(__dirname, 'config', 'ai_sites.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.sites;
    }
    console.error('need add ai_sites.josn', configPath);
    return [];
  } catch (error) {
    console.error('read error', error);
    return [];
  }
})();
const navBarHeight = 50; 
const hotKey = 'Ctrl+Q'; // 快捷键
let mainWindow;
let tray;
const views = {}; 
const loadedStates = {};
app.commandLine.appendSwitch('ignore-certificate-errors');
// 防止应用多开 
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      showWindow();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    show: true, 
    skipTaskbar: true,  
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // 允许操作，例如复制
      webSecurity: false
    },
  });
  
  mainWindow.setMenu(null);
  mainWindow.loadFile('index.html');
  mainWindow.webContents.on('did-finish-load', () => {
    createAIViews();
  });
  
  mainWindow.on('resize', () => {
    const [width, height] = mainWindow.getContentSize();
    for (const view of Object.values(views)) {
      view.setBounds({
        x: 0,
        y: navBarHeight,
        width: width, 
        height: height - navBarHeight 
      });
    }
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault(); 
      mainWindow.hide();  
    }
  });

  // 失去焦点时自动隐藏
  // mainWindow.on('blur', () => {
  //   if (mainWindow.isVisible()) {
  //     mainWindow.hide();
  //   }
  // });
}

function createAIViews() {
  const [width, height] = mainWindow.getContentSize();

  aiSites.forEach((site, index) => {
    const view = new BrowserView({
      webPreferences: {
        backgroundThrottling: true  // 允许后台节流
      }
    });
    view.setBounds({ 
      x: 0, 
      y: navBarHeight, 
      width: width, 
      height: height - navBarHeight 
    });
    // const agent = " Chrome/129.0.0.0 Firefox/70.0"
    const agent = "Chrome/129.0.6647.127 Safari/537.36 AppleWebKit/537.36 (KHTML, like Gecko)"
    view.webContents.setUserAgent(agent);
    view.webContents.loadURL(site.url);
    views[site.id] = view
    loadedStates[site.id] = false
    mainWindow.addBrowserView(view);

    view.webContents.on('did-start-loading', () => {
        loadedStates[site.id] = true;
    });
    view.webContents.on('did-frame-finish-load', () => {
        loadedStates[site.id] = true;
    });
    view.webContents.on('dom-ready', () => {
        loadedStates[site.id] = true;
    });
    view.webContents.on('did-finish-load', () => {
        loadedStates[site.id] = true; 
    });

    view.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http') && !url.startsWith(site.url)) {
        shell.openExternal(url);
        return { action: 'deny' }; 
      }
      return { action: 'allow' };
    });
  });

  /* 显示0号 默认启动会切换一次，不用管这个 */
  // if (aiSites.length > 0) {
  //   const firstView = views[aiSites[0].id];
  //   mainWindow.addBrowserView(firstView); 
  //   firstView.webContents.focus();  
  //   mainWindow.setTopBrowserView(views[aiSites[0].id]);
  // }
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets/icon.png'); 
  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    { label: `显示/隐藏 (${hotKey})`, click: toggleWindow },
    { type: 'separator' },
    { label: '退出软件', click: () => {
        app.isQuitting = true; 
        app.quit();  
      } 
    },
  ]);

  tray.setToolTip('NAiWeb');
  tray.setContextMenu(contextMenu);
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
  return aiSites.map(site => ({ id: site.id, name: site.name }));
});
ipcMain.handle('switch-view', (event, id) => {
  const view = views[id];
  console.log("switch view", view)
  if (view) {
    for (const [viewId, v] of Object.entries(views)) {
      if (viewId === id) {
        v.webContents.setBackgroundThrottling(false);
        mainWindow.removeBrowserView(v);
        mainWindow.addBrowserView(v);
      } else {
        v.webContents.setBackgroundThrottling(true);
        mainWindow.removeBrowserView(v);
      }
    }
    if (loadedStates[id] === false) {
        view.webContents.reloadIgnoringCache();
    }
    return { success: true };
  }
  return { success: false };
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  const ret = globalShortcut.register(hotKey, () => {
    toggleWindow();
  });

  if (!ret) {
    console.error('register hotkey error');
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
        loadedStates[id] = false
        view.webContents.reload(); 
    }
});