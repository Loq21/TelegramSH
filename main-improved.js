const { app, BrowserWindow, BrowserView, ipcMain, shell, clipboard, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let webview;
let isMaximized = false;

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch (e) {
    console.error('Ошибка загрузки настроек:', e);
  }
  return { 
    zoomFactor: 1.0,
    lastWindowState: { width: 1200, height: 800, x: undefined, y: undefined }
  };
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error('Ошибка сохранения настроек:', e);
  }
}

let appSettings = loadSettings();

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const windowState = appSettings.lastWindowState || {};
  const windowWidth = windowState.width || 1200;
  const windowHeight = windowState.height || 800;
  const windowX = windowState.x !== undefined ? windowState.x : (width - windowWidth) / 2;
  const windowY = windowState.y !== undefined ? windowState.y : (height - windowHeight) / 2;

  // Создаём главное окно с прозрачностью и скруглением
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: windowX,
    y: windowY,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    roundedCorners: true,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  // Загружаем UI с кнопками
  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Создаём BrowserView для Telegram Web - это исправляет проблемы с рендерингом!
    webview = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        enablePreferredSizeMode: true
      }
    });
    
    mainWindow.setBrowserView(webview);
    
    // Устанавливаем размер и позицию view (под title bar)
    const bounds = mainWindow.getBounds();
    webview.setBounds({
      x: 0,
      y: 40, // под title bar
      width: bounds.width,
      height: bounds.height - 40
    });
    
    // Загружаем Telegram
    webview.webContents.loadURL('https://web.telegram.org/k/', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.0'
    });
    
    // Устанавливаем zoom
    webview.webContents.setZoomFactor(appSettings.zoomFactor || 1.0);
    
    // Обработчики событий view
    webview.webContents.on('dom-ready', () => {
      injectCustomStyles();
      injectCustomScripts();
    });
    
    // Обработка внешних ссылок
    webview.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
  });

  // Обновляем размер view при изменении окна
  mainWindow.on('resize', () => {
    const bounds = mainWindow.getBounds();
    if (webview) {
      webview.setBounds({
        x: 0,
        y: 40,
        width: bounds.width,
        height: bounds.height - 40
      });
    }
    saveWindowState();
  });

  mainWindow.on('maximize', () => {
    isMaximized = true;
    mainWindow.webContents.send('window-state-changed', 'maximized');
    const bounds = mainWindow.getBounds();
    if (webview) {
      webview.setBounds({
        x: 0,
        y: 40,
        width: bounds.width,
        height: bounds.height - 40
      });
    }
  });

  mainWindow.on('unmaximize', () => {
    isMaximized = false;
    mainWindow.webContents.send('window-state-changed', 'restored');
    const bounds = mainWindow.getBounds();
    if (webview) {
      webview.setBounds({
        x: 0,
        y: 40,
        width: bounds.width,
        height: bounds.height - 40
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    webview = null;
  });
}

function saveWindowState() {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  appSettings.lastWindowState = {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y
  };
  saveSettings(appSettings);
}

function injectCustomStyles() {
  if (!webview) return;
  const css = `
    ::-webkit-scrollbar {
      width: 8px !important;
      height: 8px !important;
    }
    ::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.1) !important;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(100, 100, 100, 0.5) !important;
      border-radius: 4px !important;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(100, 100, 100, 0.8) !important;
    }
    .input-message-container, 
    .composer-wrapper,
    .chat-input {
      background: transparent !important;
    }
    .chat-info, 
    .sidebar-header,
    .chat-header {
      background: rgba(255, 255, 255, 0.9) !important;
      backdrop-filter: blur(10px) !important;
    }
    .night ::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.3) !important;
    }
    .night ::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2) !important;
    }
  `;
  webview.webContents.insertCSS(css).catch(console.error);
}

function injectCustomScripts() {
  if (!webview) return;
  const script = `
    document.body.classList.add('electron-app');
    document.addEventListener('copy', function(e) {
      const selection = window.getSelection().toString();
      if (selection && selection.includes('xn--')) {
        try {
          const decoded = new URL(selection).href;
          e.clipboardData.setData('text/plain', decoded);
          e.preventDefault();
        } catch(err) {}
      }
    });
  `;
  webview.webContents.executeJavaScript(script).catch(console.error);
}

// IPC обработчики
ipcMain.handle('window-minimize', () => {
  mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.handle('window-close', () => {
  mainWindow.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow.isMaximized();
});

ipcMain.handle('copy-to-clipboard', (event, text) => {
  clipboard.writeText(text);
  return true;
});

ipcMain.handle('read-clipboard', () => {
  return clipboard.readText();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
});

ipcMain.handle('zoom-in', () => {
  if (!webview) return 1.0;
  const currentZoom = webview.webContents.getZoomFactor();
  const newZoom = Math.min(currentZoom + 0.1, 3.0);
  webview.webContents.setZoomFactor(newZoom);
  appSettings.zoomFactor = newZoom;
  saveSettings(appSettings);
  return newZoom;
});

ipcMain.handle('zoom-out', () => {
  if (!webview) return 1.0;
  const currentZoom = webview.webContents.getZoomFactor();
  const newZoom = Math.max(currentZoom - 0.1, 0.5);
  webview.webContents.setZoomFactor(newZoom);
  appSettings.zoomFactor = newZoom;
  saveSettings(appSettings);
  return newZoom;
});

ipcMain.handle('zoom-reset', () => {
  if (!webview) return 1.0;
  webview.webContents.setZoomFactor(1.0);
  appSettings.zoomFactor = 1.0;
  saveSettings(appSettings);
  return 1.0;
});

// Обработчики для управления view из renderer
ipcMain.handle('navigate-url', (event, url) => {
  if (webview && url) {
    webview.webContents.loadURL(url);
  }
});

ipcMain.handle('get-current-url', () => {
  if (webview) {
    return webview.webContents.getURL();
  }
  return '';
});

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