const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Watch the shared directory for changes
config.watchFolders = [path.resolve(__dirname, "../shared")];

// Allow importing from outside the project root
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
