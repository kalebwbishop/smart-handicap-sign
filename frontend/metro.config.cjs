// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Force Metro to prefer CJS ("main") over ESM ("module")
config.resolver.resolverMainFields = ["react-native", "browser", "main"];
config.resolver.unstable_conditionNames = ["react-native", "browser", "require", "default"];

// If you're on an Expo/Metro setup where package.json "exports" is enabled,
// disabling it avoids pulling ESM builds that contain import.meta
config.resolver.unstable_enablePackageExports = true;

// Monorepo root and the actual source of the local dependency
const monorepoRoot = path.resolve(__dirname, "..");
const sharedRNSource = path.resolve(__dirname, "..", "..", "deploy-box-react-native");

// Watch the real source directory only (not the monorepo root which contains the junction)
config.watchFolders = [...(config.watchFolders || []), sharedRNSource];

// Tell Metro where to find deploy-box-react-native and other hoisted deps
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
config.resolver.extraNodeModules = {
  "deploy-box-react-native": sharedRNSource,
};

// Disable async bundle splitting — sub-bundle fetches fail through dev tunnels
config.transformer = {
  ...config.transformer,
  asyncRequireModulePath: require.resolve('metro-runtime/src/modules/asyncRequire'),
};
config.server = {
  ...config.server,
  experimentalImportBundleSupport: false,
};

module.exports = config;