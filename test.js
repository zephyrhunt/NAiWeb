const { SerialPort } = require('serialport');

SerialPort.list().then(ports => {
  console.log('检测到的串口：');
  ports.forEach(p => console.log(p.path, p.manufacturer));
}).catch(err => {
  console.error('错误：', err.message);
});