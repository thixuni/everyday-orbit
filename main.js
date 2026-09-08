const {app, BrowserWindow, Menu, shell, dialog} = require('electron');
const path = require('path');
const fs = require('fs');
const KEY = 'everyday-orbit-v1';
let win = null;
let updater = null;          // lazily required; absent in dev
let updateCheckIsManual = false;

function iconPath(){
  return path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
}

function createWindow(){
  win = new BrowserWindow({
    width: 1360, height: 880, minWidth: 940, minHeight: 600,
    title: 'Everyday Orbit',
    backgroundColor: '#F3F5F1',
    icon: iconPath(),
    webPreferences: {contextIsolation: true, nodeIntegration: false, spellcheck: true}
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.on('page-title-updated', e => e.preventDefault());
  win.webContents.setWindowOpenHandler(({url}) => {
    if(/^https?:/i.test(url)) shell.openExternal(url);
    return {action: 'deny'};
  });
  win.on('closed', () => { win = null; });
}

/* ---------- backup and restore ---------- */

async function backup(){
  if(!win) return;
  let raw = null;
  try{
    raw = await win.webContents.executeJavaScript('localStorage.getItem(' + JSON.stringify(KEY) + ')');
  }catch(e){ raw = null; }
  if(!raw){
    dialog.showMessageBox(win, {type: 'info', message: 'Nothing to back up yet', detail: 'Add a task or two first.'});
    return;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const res = await dialog.showSaveDialog(win, {
    title: 'Back up your planner',
    defaultPath: 'everyday-orbit-' + stamp + '.json',
    filters: [{name: 'Planner backup', extensions: ['json']}]
  });
  if(res.canceled || !res.filePath) return;
  let data = null;
  try{ data = JSON.parse(raw); }catch(e){ data = null; }
  const payload = {app: 'everyday-orbit', version: 1, exported: new Date().toISOString(), data: data};
  try{
    fs.writeFileSync(res.filePath, JSON.stringify(payload, null, 2), 'utf8');
    dialog.showMessageBox(win, {type: 'info', message: 'Backup saved', detail: res.filePath});
  }catch(e){
    dialog.showErrorBox('Could not save the backup', String(e && e.message || e));
  }
}

async function restore(){
  if(!win) return;
  const res = await dialog.showOpenDialog(win, {
    title: 'Restore a backup',
    properties: ['openFile'],
    filters: [{name: 'Planner backup', extensions: ['json']}]
  });
  if(res.canceled || !res.filePaths || !res.filePaths[0]) return;
  let o = null;
  try{
    o = JSON.parse(fs.readFileSync(res.filePaths[0], 'utf8'));
  }catch(e){
    dialog.showErrorBox('That file is not readable', 'It does not contain valid JSON.');
    return;
  }
  const d = (o && o.data) ? o.data : o;
  if(!d || !Array.isArray(d.tasks)){
    dialog.showErrorBox('That is not a planner backup', 'The file is missing the task list.');
    return;
  }
  const ans = await dialog.showMessageBox(win, {
    type: 'warning', buttons: ['Cancel', 'Restore'], defaultId: 1, cancelId: 0,
    message: 'Replace everything in the planner?',
    detail: 'The file holds ' + d.tasks.length + ' tasks, ' + ((d.routines || []).length) +
            ' routines and ' + ((d.notes || []).length) + ' notes. What is in the planner now will be replaced.'
  });
  if(ans.response !== 1) return;
  try{
    await win.webContents.executeJavaScript(
      'localStorage.setItem(' + JSON.stringify(KEY) + ',' + JSON.stringify(JSON.stringify(d)) + ');true'
    );
    win.reload();
  }catch(e){
    dialog.showErrorBox('Could not restore', String(e && e.message || e));
  }
}

/* ---------- updates ----------
 * Installed copies check GitHub Releases on launch and then every six hours.
 * The portable .exe and a `npm start` dev run are not updatable, so the
 * updater is never loaded there.
 */

function updatesSupported(){
  return app.isPackaged && process.env.EVERYDAY_ORBIT_NO_UPDATE !== '1';
}

function initUpdater(){
  if(!updatesSupported()) return;
  try{
    updater = require('electron-updater').autoUpdater;
  }catch(e){
    updater = null;
    return;
  }
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;

  updater.on('update-downloaded', info => {
    if(!win) return;
    dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      message: 'Everyday Orbit ' + info.version + ' is ready',
      detail: 'Your planner data is not touched by an update. Restart to finish installing, or it will be applied next time you quit.'
    }).then(r => { if(r.response === 0) updater.quitAndInstall(); });
  });

  updater.on('update-not-available', () => {
    if(updateCheckIsManual && win){
      dialog.showMessageBox(win, {
        type: 'info',
        message: 'You are up to date',
        detail: 'Everyday Orbit ' + app.getVersion() + ' is the latest version.'
      });
    }
    updateCheckIsManual = false;
  });

  updater.on('error', err => {
    if(updateCheckIsManual && win){
      dialog.showMessageBox(win, {
        type: 'warning',
        message: 'Could not check for updates',
        detail: String(err && err.message || err) + '\n\nYou can always download the latest version from the Everyday Orbit releases page.'
      });
    }
    updateCheckIsManual = false;
  });

  setTimeout(check, 4000);
  setInterval(check, 6 * 60 * 60 * 1000);
}

function check(){
  if(!updater) return;
  updater.checkForUpdates().catch(() => {});
}

function checkManually(){
  if(!updatesSupported() || !updater){
    dialog.showMessageBox(win, {
      type: 'info',
      message: 'Updates are not available in this copy',
      detail: 'Automatic updates work in the installed version. This looks like a portable or development copy, so download a new version manually when you want one.'
    });
    return;
  }
  updateCheckIsManual = true;
  check();
}

/* ---------- menu ---------- */

function about(){
  dialog.showMessageBox(win, {
    type: 'info',
    message: 'Everyday Orbit ' + app.getVersion(),
    detail: 'A personal planner: calendar, task board, Eisenhower matrix, routines and notes.\n\n' +
            'Your data is stored on this computer only, and never leaves it. ' +
            'Use File then Back up planner to save a copy or move it to another machine.'
  });
}

function buildMenu(){
  const isMac = process.platform === 'darwin';
  const template = [];
  if(isMac) template.push({role: 'appMenu'});
  template.push(
    {label: 'File', submenu: [
      {label: 'Back up planner…', accelerator: 'CmdOrCtrl+S', click: backup},
      {label: 'Restore from backup…', accelerator: 'CmdOrCtrl+O', click: restore},
      {type: 'separator'},
      isMac ? {role: 'close'} : {role: 'quit'}
    ]},
    {label: 'Edit', submenu: [
      {role: 'undo'}, {role: 'redo'}, {type: 'separator'},
      {role: 'cut'}, {role: 'copy'}, {role: 'paste'}, {role: 'selectAll'}
    ]},
    {label: 'View', submenu: [
      {role: 'reload'}, {type: 'separator'},
      {role: 'resetZoom'}, {role: 'zoomIn'}, {role: 'zoomOut'}, {type: 'separator'},
      {role: 'togglefullscreen'}
    ]},
    {label: 'Help', submenu: [
      {label: 'Check for updates…', click: checkManually},
      {type: 'separator'},
      {label: 'About Everyday Orbit', click: about}
    ]}
  );
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

if(!app.requestSingleInstanceLock()){
  app.quit();
}else{
  app.on('second-instance', () => {
    if(win){ if(win.isMinimized()) win.restore(); win.focus(); }
  });
  app.whenReady().then(() => {
    buildMenu();
    createWindow();
    initUpdater();
    app.on('activate', () => {
      if(BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on('window-all-closed', () => {
    if(process.platform !== 'darwin') app.quit();
  });
}
