// Permite importar los tokens compartidos desde ../src/design (fuera de app/).
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../src/design')];

module.exports = config;
