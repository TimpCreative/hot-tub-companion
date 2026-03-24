// @ts-check
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Pin a single react / react-dom instance so Metro never bundles a nested 19.2.x
// copy that mismatches react-native-renderer (19.1.0 on RN 0.81).
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-dom': path.resolve(projectRoot, 'node_modules/react-dom'),
};

module.exports = config;
