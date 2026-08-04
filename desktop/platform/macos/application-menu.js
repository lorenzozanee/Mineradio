'use strict';

function createApplicationMenuTemplate() {
  return [
    { role: 'appMenu' },
    { role: 'editMenu' },
    {
      label: '显示',
      submenu: [
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
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
