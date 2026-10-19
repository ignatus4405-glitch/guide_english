const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// electron-log for updater feedback
let log;
try { log = require('electron-log'); } catch (e) { log = console; }

// electron-store for persistent user progress
let Store;
try { Store = require('electron-store'); } catch (e) { Store = null; }

let store = null;
if (Store) {
  try {
    store = new Store({
      name: 'guide-english-store',
      defaults: {
        progress: {},
        settings: {
          voice: null,
          rate: 0.95,
          volume: 1,
          theme: 'light',
          lastSection: 'dashboard'
        },
        completedLessons: [],
        vocabularyProgress: {}
      }
    });
  } catch (e) {
    console.warn('Store init failed', e);
  }
}

// updater - only in production (packaged)
let autoUpdater = null;
let updaterEnabled = false;
if (app.isPackaged) {
  try {
    const updater = require('electron-updater');
    autoUpdater = updater.autoUpdater;
    autoUpdater.logger = log;
    autoUpdater.autoDownload = true;          // скачиваем в фоне, установку подтверждает пользователь
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    updaterEnabled = true;
    log.info('Updater enabled');
  } catch (e) {
    log.warn('Updater not available', e.message);
  }
} else {
  log.info('Updater disabled in dev mode');
}

let mainWindow = null;
const isDev = !app.isPackaged || process.argv.includes('--dev');

function getIconPath() {
  const candidates = [
    path.join(__dirname, '../resources/icon.ico'),
    path.join(__dirname, '../resources/icon.png'),
    path.join(__dirname, 'renderer/assets/icon.png')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    title: 'Guide English — изучай английский с нуля',
    icon: getIconPath(),
    backgroundColor: '#f8fafc',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      spellcheck: true
    },
    show: false
  });

  const indexPath = path.join(__dirname, 'renderer/index.html');
  mainWindow.loadFile(indexPath);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // graceful
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // updater check after window ready
  if (updaterEnabled && autoUpdater) {
    // check 5 sec after launch
    setTimeout(() => {
      try {
        log.info('Checking for updates via GitHub Releases...');
        autoUpdater.checkForUpdates().catch(err => {
          log.error('Update check failed:', err.message);
        });
      } catch (e) {
        log.error('Updater check error', e);
      }
    }, 5000);

    // periodic check every 4 hours
    setInterval(() => {
      autoUpdater.checkForUpdates().catch(()=>{});
    }, 4 * 60 * 60 * 1000);
  }

  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'Файл',
      submenu: [
        { role: 'quit', label: 'Выход' }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload', label: 'Перезагрузить' },
        { role: 'forceReload', label: 'Принудительная перезагрузка' },
        { role: 'toggleDevTools', label: 'Инструменты разработчика' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Сбросить масштаб' },
        { role: 'zoomIn', label: 'Увеличить' },
        { role: 'zoomOut', label: 'Уменьшить' },
        { role: 'togglefullscreen', label: 'Полный экран' }
      ]
    },
    {
      label: 'Помощь',
      submenu: [
        {
          label: `О программе — v${app.getVersion()}`,
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'О программе Guide English',
              message: `Guide English v${app.getVersion()}`,
              detail: 'Программа для изучения английского: правила, объяснения на русском, аудирование и тесты.\n\nОбновления приходят автоматически через GitHub Releases.\nСайт: https://github.com/ignatus4405-glitch/guide_english',
              buttons: ['OK', 'Открыть GitHub'],
              defaultId: 0
            }).then(({ response }) => {
              if (response === 1) shell.openExternal('https://github.com/ignatus4405-glitch/guide_english');
            });
          }
        },
        {
          label: 'Проверить обновления',
          click: () => checkForUpdatesManually()
        },
        {
          label: 'Открыть GitHub Releases',
          click: () => shell.openExternal('https://github.com/ignatus4405-glitch/guide_english/releases')
        },
        { type: 'separator' },
        {
          label: 'Сообщить об ошибке',
          click: () => shell.openExternal('https://github.com/ignatus4405-glitch/guide_english/issues/new')
        }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function checkForUpdatesManually() {
  if (!updaterEnabled || !autoUpdater) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Обновления',
      message: isDev
        ? 'Проверка обновлений доступна только в установленной версии (не в Dev-режиме).'
        : 'Поиск обновлений...',
      detail: isDev
        ? 'Соберите установщик через GitHub Actions и установите приложение. После этого проверка будет идти через GitHub Releases.'
        : `Текущая версия: ${app.getVersion()}\nПроверка выполняется в фоне. Если выйдет новая версия — вы получите уведомление.`
    });
    // also try check even in dev if updater exists but not disabled? In dev we skip.
    return;
  }
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Проверка обновлений',
    message: 'Ищем новую версию на GitHub...',
    detail: `Текущая версия: ${app.getVersion()}`
  });
  autoUpdater.checkForUpdates().catch(err => {
    dialog.showErrorBox('Ошибка проверки обновлений', err.message);
  });
}

// === UPDATER EVENTS -> RENDERER via IPC ===
function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function setupUpdaterEvents() {
  if (!autoUpdater) return;
  autoUpdater.on('checking-for-update', () => {
    log.info('checking-for-update');
    sendToRenderer('updater:checking');
  });
  autoUpdater.on('update-available', (info) => {
    log.info('update-available', info);
    sendToRenderer('updater:available', info);
    // optional native notification
    try {
      const { Notification } = require('electron');
      if (Notification.isSupported()) {
        new Notification({
          title: 'Доступно обновление Guide English',
          body: `Версия ${info.version} уже на GitHub. Загрузка началась — приложение обновится автоматически.`,
          icon: getIconPath()
        }).show();
      }
    } catch {}
  });
  autoUpdater.on('update-not-available', (info) => {
    log.info('update-not-available', info.version);
    sendToRenderer('updater:not-available', info);
  });
  autoUpdater.on('download-progress', (prog) => {
    log.info(`download-progress ${Math.round(prog.percent)}%`);
    sendToRenderer('updater:progress', prog);
  });
  autoUpdater.on('update-downloaded', (info) => {
    log.info('update-downloaded', info.version);
    sendToRenderer('updater:downloaded', info);
    // Dialog offering restart
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Обновление загружено',
      message: `Guide English ${info.version} готова к установке`,
      detail: 'Новая версия загружена с GitHub Releases. Перезапустить приложение сейчас, чтобы установить обновление?',
      buttons: ['Установить и перезапустить', 'Напомнить позже'],
      defaultId: 0,
      cancelId: 1
    }).then(({ response }) => {
      if (response === 0) {
        try { autoUpdater.quitAndInstall(); } catch (e) { log.error(e); }
      }
    });
  });
  autoUpdater.on('error', (err) => {
    log.error('updater error', err);
    sendToRenderer('updater:error', { message: err.message, stack: err.stack });
  });
}

// === IPC HANDLERS ===
function setupIpc() {
  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:getPath', (e, name) => app.getPath(name));
  ipcMain.handle('app:isPackaged', () => app.isPackaged);
  ipcMain.handle('app:checkForUpdates', () => {
    if (updaterEnabled && autoUpdater) {
      return autoUpdater.checkForUpdates().then(() => ({ ok: true })).catch(err => ({ ok: false, error: err.message }));
    }
    return Promise.resolve({ ok: false, error: isDev ? 'Updater disabled in dev mode' : 'Updater not available' });
  });
  ipcMain.handle('app:quitAndInstall', () => {
    if (autoUpdater) {
      autoUpdater.quitAndInstall();
      return { ok: true };
    }
    return { ok: false, error: 'No updater' };
  });
  ipcMain.handle('app:openExternal', (e, url) => {
    shell.openExternal(url);
    return { ok: true };
  });
  ipcMain.handle('store:get', (e, key, def) => {
    if (!store) return def ?? null;
    return key ? store.get(key, def) : store.store;
  });
  ipcMain.handle('store:set', (e, key, val) => {
    if (!store) return { ok: false };
    store.set(key, val);
    return { ok: true };
  });
  ipcMain.handle('store:delete', (e, key) => {
    if (!store) return { ok: false };
    store.delete(key);
    return { ok: true };
  });
  ipcMain.handle('store:clearProgress', () => {
    if (!store) return { ok: false };
    store.set('progress', {});
    store.set('completedLessons', []);
    return { ok: true };
  });
  ipcMain.handle('dialog:showMessage', async (e, opts) => {
    const r = await dialog.showMessageBox(mainWindow, opts);
    return r;
  });
}

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    setupIpc();
    setupUpdaterEvents();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  // Security: deny navigation to external http
  app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (ev, url) => {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        // allow only file://
        if (!url.startsWith('file://')) {
          ev.preventDefault();
          shell.openExternal(url);
        }
      }
    });
  });
}

// handle uncaught
process.on('uncaughtException', (err) => {
  log.error('uncaughtException', err);
});
