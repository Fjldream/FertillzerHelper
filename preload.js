const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppConfig: () => ipcRenderer.invoke('app:getConfig'),
  getMachineCode: () => ipcRenderer.invoke('license:getMachineCode'),
  verifyLicense: (machineCode, licenseKey) => ipcRenderer.invoke('license:verify', machineCode, licenseKey),
  saveLicense: (data) => ipcRenderer.invoke('license:save', data),
  loadLicense: () => ipcRenderer.invoke('license:load'),
  checkActivation: () => ipcRenderer.invoke('license:check'),
  // 备份
  saveBackup: (data) => ipcRenderer.invoke('backup:save', data),
  getBackupPath: () => ipcRenderer.invoke('backup:getPath'),
});
