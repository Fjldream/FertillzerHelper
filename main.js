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

/** machine_id 持久化文件路径 */
function getMachineIdPath() {
  return path.join(app.getPath('userData'), 'machine_id.json');
}

/** License 文件路径 */
function getLicensePath() {
  return path.join(app.getPath('userData'), 'license.json');
}

/**
 * 计算硬件机器码（不读缓存）
 * 与旧逻辑相比：
 *   1. 收集所有外部 MAC，去重排序后拼接 —— 避免单块网卡顺序变化导致机器码漂移
 *   2. 加入 CPU 型号作为补充信号，防止全部 MAC 暂时缺失（如全部断网/禁用）时机器码崩塌
 */
function computeHardwareMachineCode() {
  const hostname = os.hostname();
  const nets = os.networkInterfaces();
  const macs = [];
  for (const name of Object.keys(nets || {})) {
    const list = nets[name] || [];
    for (const net of list) {
      if (net && !net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
        macs.push(net.mac.toLowerCase());
      }
    }
  }
  const macKey = Array.from(new Set(macs)).sort().join(',');

  const cpus = os.cpus() || [];
  const cpuModel = (cpus[0] && cpus[0].model) ? cpus[0].model.trim() : '';

  const raw = `${hostname}|${macKey}|${os.platform()}|${cpuModel}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return hash.substring(0, 16).toUpperCase().match(/.{4}/g).join('-');
}

/**
 * 获取稳定机器码：
 *   - 优先从 userData/machine_id.json 读取（首次激活后绑定，硬件再变都不会改）
 *   - 文件缺失时基于硬件计算并持久化
 *   - 已激活用户（license.json 中存有 machineCode）会以 license 中的机器码为准回填，
 *     防止历史用户升级后因机器码逻辑变化而被踢出激活
 */
function getStableMachineCode() {
  const idPath = getMachineIdPath();

  // 1. 命中持久化文件，直接返回
  try {
    const saved = JSON.parse(fs.readFileSync(idPath, 'utf8'));
    if (saved && typeof saved.machineCode === 'string' && saved.machineCode) {
      return saved.machineCode;
    }
  } catch (_) { /* 文件不存在或损坏，继续 */ }

  // 2. 历史用户兼容：如果已经存在 license.json 且里面带 machineCode，则视为权威
  let code = '';
  try {
    const lic = JSON.parse(fs.readFileSync(getLicensePath(), 'utf8'));
    if (lic && typeof lic.machineCode === 'string' && lic.machineCode) {
      code = lic.machineCode;
    }
  } catch (_) { /* 没有就忽略 */ }

  // 3. 否则基于硬件计算
  if (!code) code = computeHardwareMachineCode();

  // 4. 持久化（写失败不影响返回）
  try {
    fs.writeFileSync(idPath, JSON.stringify({
      machineCode: code,
      generatedAt: new Date().toISOString(),
    }, null, 2));
  } catch (_) {}

  return code;
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
    // 写入前确保 machineCode 字段以当前稳定机器码为准，便于后续启动直接信任
    const payload = { ...(data || {}) };
    if (!payload.machineCode) payload.machineCode = getStableMachineCode();
    fs.writeFileSync(getLicensePath(), JSON.stringify(payload, null, 2));
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
  try {
    const content = fs.readFileSync(getLicensePath(), 'utf8');
    const saved = JSON.parse(content);
    if (!saved || !saved.licenseKey) return { activated: false };

    // 优先用 license.json 中保存的 machineCode 验签 —— 避免硬件指纹偶发变化误踢用户
    const candidates = [];
    if (saved.machineCode) candidates.push(saved.machineCode);
    const currentCode = getStableMachineCode();
    if (!candidates.includes(currentCode)) candidates.push(currentCode);

    let result = { valid: false, message: '激活码无效或已被篡改' };
    for (const code of candidates) {
      const r = verifyLicenseSignature(code, saved.licenseKey);
      if (r.valid) { result = r; break; }
      result = r;
    }

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
