const { app, BrowserWindow, ipcMain, dialog, Menu, clipboard, nativeImage } = require('electron');
const path = require('path');
const FFmpegService = require('./ffmpeg-service');

let mainWindow;
const ffmpegService = new FFmpegService();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 480,
    minHeight: 360,
    frame: false,
    transparent: true,
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Setup window events for maximize state
  setupWindowEvents();

  // Remove application menu (we use custom titlebar)
  Menu.setApplicationMenu(null);
}

// Window control IPC handlers
ipcMain.on('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on('window-close', () => {
  mainWindow?.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow?.isMaximized() ?? false;
});

ipcMain.on('set-window-size', (event, { width, height, center }) => {
  if (mainWindow) {
    mainWindow.setSize(Math.round(width), Math.round(height));
    if (center) {
      mainWindow.center();
    }
  }
});

// Send maximize state changes to renderer
function setupWindowEvents() {
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-maximized', false);
  });
}

app.whenReady().then(() => {
  createWindow();

  // Handle files opened via double-click or command line
  if (process.argv.length > 1) {
    // Filter for video files
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.wmv', '.flv', '.m4v'];
    const videoFiles = process.argv.slice(1).filter(arg => videoExtensions.some(ext => arg.toLowerCase().endsWith(ext)));
    if (videoFiles.length > 0) {
      mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.send('file-opened', videoFiles);
      });
    }
  }

  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    // Send file to renderer
    mainWindow.webContents.send('file-opened', [filePath]);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Videos', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv', 'flv', 'm4v'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('get-video-metadata', async (event, filePath) => {
  try {
    return await ffmpegService.getMetadata(filePath);
  } catch (error) {
    console.error('Error getting metadata:', error);
    throw error;
  }
});

ipcMain.handle('extract-frame', async (event, filePath, frameNumber, frameRate) => {
  try {
    return await ffmpegService.extractFrame(filePath, frameNumber, frameRate);
  } catch (error) {
    console.error('Error extracting frame:', error);
    throw error;
  }
});

ipcMain.handle('extract-frames-batch', async (event, filePath, frameNumbers, frameRate) => {
  try {
    return await ffmpegService.extractFramesBatch(filePath, frameNumbers, frameRate);
  } catch (error) {
    console.error('Error extracting frames batch:', error);
    throw error;
  }
});

ipcMain.handle('copy-image-to-clipboard', (event, dataUrl) => {
  try {
    const image = nativeImage.createFromDataURL(dataUrl);
    clipboard.writeImage(image);
    return true;
  } catch (error) {
    console.error('Error copying image to clipboard:', error);
    return false;
  }
});
