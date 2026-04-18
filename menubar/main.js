const { menubar } = require('menubar');
const path = require('path');
const { ipcMain, nativeImage, Menu } = require('electron');
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

mb.on('after-create-window', () => {
    // Uncomment to open devtools for debugging
    // mb.window.webContents.openDevTools({ mode: 'detach' });
});

// Handle refresh request from renderer
ipcMain.on('refresh-events', () => {
    mb.window.webContents.send('do-refresh');
});
