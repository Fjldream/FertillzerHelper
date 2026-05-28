/**
 * license.js — 激活码验证模块（渲染进程薄封装）
 * 实际验证逻辑在主进程中执行，通过 preload.js 暴露的 electronAPI 调用
 */

/** 生成机器码（由主进程计算，基于硬件信息） */
async function generateMachineCode() {
  if (window.electronAPI) {
    return await window.electronAPI.getMachineCode();
  }
  // 降级方案（纯浏览器环境，如 license-generator.html）
  return fallbackMachineCode();
}

/** 验证激活码 */
async function verifyLicense(machineCode, licenseKey) {
  if (window.electronAPI) {
    return await window.electronAPI.verifyLicense(machineCode, licenseKey);
  }
  return { valid: false, message: '验证服务不可用' };
}

/** 保存激活信息 */
function saveLicense(machineCode, licenseKey, expiryDate) {
  if (window.electronAPI) {
    window.electronAPI.saveLicense({ machineCode, licenseKey, expiryDate });
  }
  // 同时保留 localStorage 作为备份（方便迁移）
  localStorage.setItem('license_machine', machineCode);
  localStorage.setItem('license_key', licenseKey);
  localStorage.setItem('license_expiry', expiryDate);
}

/** 读取激活信息 */
async function loadLicense() {
  if (window.electronAPI) {
    const data = await window.electronAPI.loadLicense();
    if (data) return data;
  }
  // 降级：从 localStorage 读取（兼容旧版本迁移）
  return {
    machineCode: localStorage.getItem('license_machine'),
    licenseKey: localStorage.getItem('license_key'),
    expiryDate: localStorage.getItem('license_expiry')
  };
}

/** 检查是否已激活 */
async function checkActivation() {
  if (window.electronAPI) {
    return await window.electronAPI.checkActivation();
  }
  return { activated: false };
}

/** 降级机器码生成（纯浏览器环境，仅用于 license-generator） */
async function fallbackMachineCode() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('fingerprint', 2, 2);
  const canvasFingerprint = canvas.toDataURL();

  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    canvasFingerprint.substring(0, 100)
  ].join('|');

  const msgBuffer = new TextEncoder().encode(fingerprint);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex.substring(0, 16).toUpperCase().match(/.{4}/g).join('-');
}
