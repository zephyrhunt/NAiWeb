console.log('Hello from Electron 👋')
const { app, BrowserWindow } = require('electron')

// const createWindow = function() {
const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600
  })

  win.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow()

  app.on("window-all-closed", () => {
    app.quit()
    console.log("quit app")
  })
})