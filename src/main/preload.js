const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  
  // Video metadata
  getVideoMetadata: (filePath) => ipcRenderer.invoke('get-video-metadata', filePath),
  
  // Frame extraction
  extractFrame: (filePath, frameNumber, frameRate) => 
    ipcRenderer.invoke('extract-frame', filePath, frameNumber, frameRate),
  
  extractFramesBatch: (filePath, frameNumbers, frameRate) =>
    ipcRenderer.invoke('extract-frames-batch', filePath, frameNumbers, frameRate),
  
  // Event listeners
  onFileOpened: (callback) => {
    ipcRenderer.on('file-opened', (event, filePath) => callback(filePath));
  },
  
  // Window controls
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowMaximized: (callback) => {
    ipcRenderer.on('window-maximized', (event, isMaximized) => callback(isMaximized));
  }
});
