// Empêche le rejet des certificats auto-signés par les antivirus ou proxies locaux
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ignore les fichiers volumineux générés (fichiers .aab, caches) pour préserver la mémoire de Metro
config.resolver.blockList = [
  /.*\.aab$/,
  /.*\.apk$/,
  /.*[/\\]dist_test[/\\].*/,
];

module.exports = config;
