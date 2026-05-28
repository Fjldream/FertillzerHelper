const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');

let mainWindow;

// ===== 激活码相关 =====

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwDliNbXi90S2m69MhkuO
Xr6XX6rV9AelTRtBGcRfXwa+bUot2h2RaeBWFlNdVl/LmR7+QYCOI0MlxetRjAys
bsqvWx8MnBAllweFBm3vFgVK5JwxaujstIo/YQTIgzs5BkyB7BC+vDz2eTUtPN4D
43+vUtaM0B4uA7vHmiviMppxkWDpUOVSS6EmAHO+29mWqzfuAl9qwoGN22SoeWnJ
vMpVsMvwW3A3rU20J7dcHwwzZEA9bCpNVkiBrpkPVCFjjMSdyeukyGz797B9FVt6
LMZZvQ7Xnrnz9sJ8LRVnQKI+O5Z5WtamrkEElkZukZ1ohjDy/HEnDjUesZ2RdAOr
qQIDAQAB
-----END PUBLIC KEY-----`;

/** 生成稳定机器码（基于 hostname + MAC 地址） */
function getStableMachineCode() {
  const hostname = os.hostname();
  const nets = os.networkInterfaces();
  let mac = '';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (!net.internal && net.mac !== '00:00:00:00:00:00') {
        mac = net.mac;
        break;
      }
    }
    if (mac) break;
  }
  const raw = `${hostname}|${mac}|${os.platform()}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return hash.substring(0, 16).toUpperCase().match(/.{4}/g).join('-');
}

/** License 文件路径 */
function getLicensePath() {
  return path.join(app.getPath('userData'), 'license.json');
}

/** 验证激活码签名 */
function verifyLicenseSignature(machineCode, licenseKey) {
  try {
    const parts = licenseKey.split('.');
    if (parts.length !== 2) return { valid: false, message: '激活码格式错误' };

    const [signatureB64, expiryB64] = parts;
    const expiryDate = Buffer.from(expiryB64, 'base64').toString('utf8');

    // 检查是否过期
    const expiry = new Date(expiryDate);
    const now = new Date();
    if (now > expiry) {
      return { valid: false, message: '激活码已过期（到期日：' + expiryDate + '）' };
    }

    // 验证 RSA-PSS 签名
    const dataToSign = machineCode + '|' + expiryDate;
    const signature = Buffer.from(signatureB64, 'base64');

    const isValid = crypto.verify(
      'sha256',
      Buffer.from(dataToSign),
      { key: PUBLIC_KEY, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 },
      signature
    );

    if (!isValid) {
      return { valid: false, message: '激活码无效或已被篡改' };
    }

    return { valid: true, expiryDate };
  } catch (e) {
    return { valid: false, message: '激活码验证失败：' + e.message };
  }
}

// ===== IPC Handlers =====

ipcMain.handle('license:getMachineCode', () => getStableMachineCode());

ipcMain.handle('license:verify', (event, machineCode, licenseKey) => {
  return verifyLicenseSignature(machineCode, licenseKey);
});

ipcMain.handle('license:save', (event, data) => {
  try {
    fs.writeFileSync(getLicensePath(), JSON.stringify(data, null, 2));
    return true;
  } catch { return false; }
});

ipcMain.handle('license:load', () => {
  try {
    const content = fs.readFileSync(getLicensePath(), 'utf8');
    return JSON.parse(content);
  } catch { return null; }
});

ipcMain.handle('license:check', () => {
  const machineCode = getStableMachineCode();
  try {
    const content = fs.readFileSync(getLicensePath(), 'utf8');
    const saved = JSON.parse(content);
    if (!saved || !saved.licenseKey) return { activated: false };

    const result = verifyLicenseSignature(machineCode, saved.licenseKey);
    return {
      activated: result.valid,
      expiryDate: result.expiryDate || saved.expiryDate,
      message: result.message
    };
  } catch {
    return { activated: false };
  }
});

// ===== 数据备份 =====

ipcMain.handle('backup:save', (event, data) => {
  try {
    const backupDir = path.join(app.getPath('userData'), 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const date = new Date().toISOString().slice(0, 10);
    const filePath = path.join(backupDir, `backup_${date}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    // 只保留最近 30 个备份
    const files = fs.readdirSync(backupDir).filter(f => f.startsWith('backup_')).sort();
    while (files.length > 30) {
      fs.unlinkSync(path.join(backupDir, files.shift()));
    }

    return { success: true, path: filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('backup:getPath', () => {
  return path.join(app.getPath('userData'), 'backups');
});

// ===== 窗口创建 =====

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    center: true,
    title: 'FertilizerHelper',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'default',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // 捕获渲染进程错误
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    process.stdout.write(`[Renderer L${level}] ${message}\n`);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 菜单
  const template = [
    ...(process.platform === 'darwin' ? [{
      label: app.name,
      submenu: [
        { role: 'about', label: '关于' },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    }] : []),
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    ...(process.platform !== 'darwin' ? [{
      label: '帮助',
      submenu: [
        { role: 'about', label: '关于' }
      ]
    }] : [])
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // 仅开发环境允许 F12 打开 DevTools
  if (!app.isPackaged) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12') {
        mainWindow.webContents.toggleDevTools();
      }
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Electron 准备就绪
app.whenReady().then(createWindow);

// 所有窗口关闭时退出（Windows/Linux）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS 点击 dock 图标重新创建窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
