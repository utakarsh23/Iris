const { menubar } = require('menubar');
const path = require('path');
const { app, ipcMain, nativeImage, Menu, Notification, powerMonitor } = require('electron');
const mb = menubar({
    index: `file://${path.join(__dirname, 'index.html')}`,
    browserWindow: {
        width: 420,
        height: 580,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    },
    preloadWindow: true,
    showDockIcon: false,
    icon: path.join(__dirname, 'assets', 'iconTemplate.png')
});

mb.on('ready', () => {
    console.log('Iris menubar app is ready!');

    // Launch Iris on Mac startup
    app.setLoginItemSettings({ openAtLogin: true });

    // Create right-click context menu
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Quit Iris',
            click: () => {
                mb.app.quit();
            }
        }
    ]);

    mb.tray.on('right-click', () => {
        mb.tray.popUpContextMenu(contextMenu);
    });
});

// IPC handler: renderer sends notification requests here
ipcMain.on('show-notification', (event, { title, body }) => {
    const notif = new Notification({ title, body });
    notif.show();
});

mb.on('after-create-window', () => {
    // Uncomment to open devtools for debugging
    // mb.window.webContents.openDevTools({ mode: 'detach' });
});

// Handle refresh request from renderer
ipcMain.on('refresh-events', () => {
    mb.window.webContents.send('do-refresh');
});

// When Mac wakes from sleep, tell renderer to check notifications immediately
mb.on('ready', () => {
    powerMonitor.on('resume', () => {
        if (mb.window) {
            mb.window.webContents.send('system-wake');
        }
    });
});
