const { app, WebContentsView, BrowserWindow, ipcMain, webContents, globalShortcut, Tray, Menu, shell } = require('electron');

const fs = require('fs');
const path = require('path');
const CONFIG_DIR = path.join(app.getAppPath(), 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'ai_sites.json');

let aiSites = []
function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    if (fs.existsSync(CONFIG_FILE)) {
      const configJson = fs.readFileSync(CONFIG_FILE, 'utf8');
      const config = JSON.parse(configJson);
      aiSites = Array.isArray(config.sites) ? config.sites : [];
      console.log(`Config loaded: ${aiSites.length} sites.`);
      return true;
    } else {
      // 如果文件不存在，创建空文件
      saveConfig({ sites: [] });
      aiSites = [];
      console.log('ai_sites.json not found, created an empty config file.');
      return true;
    }
  } catch (error) {
    console.error('Error loading or parsing config:', error);
    aiSites = [];
    return false;
  }
}
/**
 * 将 aiSites 数组写入文件
 * @param {object} configData - 包含 { sites: [] } 的配置对象
 */
function saveConfig(configData) {
  try {
    const configJson = JSON.stringify(configData, null, 2);
    fs.writeFileSync(CONFIG_FILE, configJson, 'utf8');
    console.log('Config saved successfully.');
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

const navBarHeight = 50;
const hotKey = 'Ctrl+Q';
let mainWindow;
let tray;
let views = [];
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

loadConfig();

/**
 * @brief 创建主窗口，加载index.html
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,
    skipTaskbar: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    },
  });

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


/**
 * @brief 创建默认的窗口，给定尺寸，绑定preload.js中的函数
 */
function createDefaultView() {
  const [width, height] = mainWindow.getContentSize();
  const view = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
    }
  })
  mainWindow.contentView.addChildView(view)
  view.setBounds({
    x: 0,
    y: navBarHeight,
    width: width,
    height: height - navBarHeight
  });
  const agent = "Chrome/129.0.6647.127 Safari/537.36 AppleWebKit/537.36 (KHTML, like Gecko)"
  view.webContents.setUserAgent(agent);
  return view;
}

function createAIViews() {
  const add_view = createDefaultView()
  add_view.webContents.loadFile(path.join(__dirname, 'add_site.html'));
  views['add'] = add_view
  mainWindow.contentView.addChildView(add_view)
  aiSites.forEach((site, index) => {
    const view = createDefaultView()
    views[site.name] = view
    loadedStates[site.name] = false
    mainWindow.contentView.addChildView(view)
    view.webContents.on('did-frame-finish-load', () => {
      loadedStates[site.name] = true;
    });
    view.webContents.on('dom-ready', () => {
      loadedStates[site.name] = true;
    });
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets/icon.png');
  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    { label: `显示/隐藏 (${hotKey})`, click: toggleWindow },
    { type: 'separator' },
    {
      label: '退出软件', click: () => {
        app.isQuitting = true;
        app.quit();
      }
    },
  ]);

  tray.setToolTip('NAiWeb');
  tray.setContextMenu(contextMenu);
  tray.on('click', toggleWindow);
}

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
  return aiSites.map(site => ({ id: site.name, name: site.name }));
});
ipcMain.handle('switch-view', (event, id) => {
  const view = views[id];
  console.log("switch view", id, view)
  if (view) {
    for (const [viewId, v] of Object.entries(views)) {
      if (viewId === id) {
        mainWindow.contentView.removeChildView(v)
        mainWindow.contentView.addChildView(v)
      } else {
        mainWindow.contentView.removeChildView(v)
      }
    }
    const siteObject = aiSites.find(site => site.name === id);
    if (loadedStates[id] === false && id != 'add') {
      view.webContents.loadURL(siteObject.url);
      view.webContents.reloadIgnoringCache();
    }
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('add-site', async (event, newSite) => {
  console.log('addsite', newSite.name, newSite.url);
  loadConfig();
  if (aiSites.some(site => site.name === newSite.name)) {
    console.log("already exists", newSite.name);
    return { success: false, message: `ID "${newSite.name}" already exists.` };
  }
  aiSites.push(newSite)
  const success = saveConfig({ sites: aiSites })
  if (success) {
    mainWindow.send('site-added', newSite);
    console.log("save success", aiSites)
  }
  const view = createDefaultView();
  const site = newSite;
  views[site.name] = view;
  loadedStates[site.name] = false;
  // mainWindow.contentView.addChildView(view);
  view.webContents.on('did-frame-finish-load', () => {
    loadedStates[site.name] = true;
  });
  view.webContents.on('dom-ready', () => {
    loadedStates[site.name] = true;
  });
});

ipcMain.handle('delete-site', async (event, name) => {
  console.log("delete_site", name, views)
  const viewToRemove = views[name]
  console.log("view", viewToRemove);
  const index = aiSites.findIndex(site => site.name === name); // 假设 id 是 name
  if (index === -1) {
    throw new Error('Site not found');
  }
  aiSites.splice(index, 1);
  const success = saveConfig({ sites: aiSites });
  if (success) {
    console.log("delete and save success")
    if (viewToRemove) {
      try {
        mainWindow.contentView.removeChildView(viewToRemove)
        console.log(`BrowserView for "${name}" removed and destroyed.`);
        delete views[name]
      } catch (error) {
        console.error(`Failed to remove BrowserView for "${name}":`, error);
      }
    }
  }
  return { success: true }; // 返回成功响应
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
