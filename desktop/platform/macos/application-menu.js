'use strict';

function createApplicationMenuTemplate() {
  return [
    {
      role: 'appMenu',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      role: 'editMenu',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '显示',
      submenu: [
        { role: 'togglefullscreen' },
      ],
    },
    {
      role: 'windowMenu',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ];
}

function installApplicationMenu(options = {}) {
  const Menu = options.Menu;
  if (!Menu || typeof Menu.buildFromTemplate !== 'function'
    || typeof Menu.setApplicationMenu !== 'function') {
    return { ok: false, error: 'MACOS_APPLICATION_MENU_UNAVAILABLE' };
  }
  const template = createApplicationMenuTemplate();
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return { ok: true };
}

module.exports = {
  createApplicationMenuTemplate,
  installApplicationMenu,
};
