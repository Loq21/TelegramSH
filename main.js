const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Отключаем лишние логи
app.commandLine.appendSwitch('log-level', '3');

const configPath = path.join(app.getPath('userData'), 'window-state.json');

const loadWindowState = () => {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {}
  return null;
};

const saveWindowState = (win) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(win.getBounds()));
  } catch (e) {}
};

let win;

app.whenReady().then(() => {
  const saved = loadWindowState();
  
  win = new BrowserWindow({
    width: saved?.width || 1200,
    height: saved?.height || 800,
    x: saved?.x,
    y: saved?.y,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1c1c1c',
    show: true,
    icon: path.join(__dirname, 'icon.ico'),
    title: 'TelegramSH', // Кастомный заголовок окна
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.setMenu(null);
  if (process.platform === 'darwin') app.applicationMenu = null;

  // Принудительно устанавливаем заголовок после загрузки
  win.webContents.on('dom-ready', () => {
    win.setTitle('TelegramSH');
  });

  win.on('resize', () => saveWindowState(win));
  win.on('move', () => saveWindowState(win));

  win.loadURL('https://web.telegram.org/k/');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});