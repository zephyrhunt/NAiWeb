// 获取所有 DOM 元素
const portSelect = document.getElementById('port-select');
const baudRateSelect = document.getElementById('baud-rate-select');
const refreshBtn = document.getElementById('refresh-btn');
const connectBtn = document.getElementById('connect-btn');
const logContainer = document.getElementById('log-container');
const sendInput = document.getElementById('send-input');
const sendBtn = document.getElementById('send-btn');
const hexSendCheck = document.getElementById('hex-send-check');
const hexReceiveCheck = document.getElementById('hex-receive-check');
const clearLogBtn = document.getElementById('clear-log-btn');

let isConnected = false;

// 格式化时间戳 (HH:MM:SS.ms)
function getTimestamp() {
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    const s = now.getSeconds().toString().padStart(2, '0');
    const ms = now.getMilliseconds().toString().padStart(3, '0');
    return `${h}:${m}:${s}.${ms}`;
}

// 格式化 Buffer 为 Hex 字符串
function bufferToHex(buffer) {
    return buffer.toString('hex').toUpperCase().match(/.{1,2}/g).join(' ');
}

// 在日志区添加条目
function addLog(data, type = 'rx') {
    const entry = document.createElement('div');
    entry.classList.add('log-entry');

    const time = document.createElement('span');
    time.classList.add('log-time');
    time.textContent = `[${getTimestamp()}]`;
    
    const dataSpan = document.createElement('span');
    dataSpan.classList.add('log-data', type);

    if (type === 'rx') {
        dataSpan.textContent = `RX: ${hexReceiveCheck.checked ? bufferToHex(data) : data.toString()}`;
    } else {
        dataSpan.textContent = `TX: ${data}`;
    }

    entry.appendChild(time);
    entry.appendChild(dataSpan);
    logContainer.appendChild(entry);

    // 自动滚动到底部
    logContainer.parentElement.scrollTop = logContainer.parentElement.scrollHeight;
}

// 扫描串口
async function scanPorts() {
    const ports = await window.api.scanPorts();
    portSelect.innerHTML = ''; // 清空
    if (ports.error) {
        addLog(`扫描错误: ${ports.error}`, 'error');
        return;
    }
    if (ports.length === 0) {
        const option = document.createElement('option');
        option.textContent = '未找到串口';
        portSelect.appendChild(option);
        return;
    }
    ports.forEach(port => {
        const option = document.createElement('option');
        option.value = port.path;
        option.textContent = `${port.path} (${port.manufacturer || 'N/A'})`;
        portSelect.appendChild(option);
    });
}

// 切换连接状态的 UI
function setConnectionStatus(connected) {
    isConnected = connected;
    connectBtn.textContent = connected ? '断开' : '连接';
    connectBtn.classList.toggle('connected', connected); // 切换为红色
    sendBtn.disabled = !connected;
    portSelect.disabled = connected;
    baudRateSelect.disabled = connected;
    refreshBtn.disabled = connected;
}

// --- 事件监听 ---

// 1. 刷新按钮
refreshBtn.addEventListener('click', scanPorts);

// 2. 连接/断开按钮
connectBtn.addEventListener('click', async () => {
    if (isConnected) {
        // 断开连接
        const result = await window.api.disconnectPort();
        if (result.success) {
            setConnectionStatus(false);
            addLog('连接已断开', 'system');
        } else {
            addLog(`断开失败: ${result.error}`, 'error');
        }
    } else {
        // 连接
        const path = portSelect.value;
        const baudRate = baudRateSelect.value;
        if (!path || path === '未找到串口') {
            addLog('请选择一个有效的串口', 'error');
            return;
        }

        connectBtn.textContent = '连接中...';
        connectBtn.classList.add('connecting'); // 脉冲动画
        connectBtn.disabled = true;

        const result = await window.api.connectPort(path, baudRate);

        connectBtn.classList.remove('connecting');
        connectBtn.disabled = false;

        if (result.success) {
            setConnectionStatus(true);
            addLog(`已连接到 ${path} @ ${baudRate}`, 'system');
        } else {
            setConnectionStatus(false);
            addLog(`连接失败: ${result.error}`, 'error');
        }
    }
});

// 3. 发送按钮
sendBtn.addEventListener('click', () => {
    const data = sendInput.value;
    if (!data) return;
    
    const format = hexSendCheck.checked ? 'hex' : 'text';
    window.api.sendData(data, format);
    
    // 在日志中显示发送的数据
    let logData = data;
    if (format === 'hex') {
        logData = data.toUpperCase().match(/.{1,2}/g).join(' ');
    }
    addLog(logData, 'tx');
    sendInput.value = ''; // 清空输入框
});

// 4. 清空日志
clearLogBtn.addEventListener('click', () => {
    logContainer.innerHTML = '';
});

// 5. 监听来自主进程的数据
window.api.onSerialData((data) => {
    addLog(data, 'rx'); // data 是一个 Buffer
});

// 6. 页面加载时自动扫描
window.addEventListener('DOMContentLoaded', () => {
    scanPorts();
});