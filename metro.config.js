const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// whisper.rn's exports map has no root entry, so Metro falls back to its TypeScript source, which
// pulls in safe-buffer and expects Node's buffer module. The npm package stands in for it.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  buffer: require.resolve('buffer'),
};

module.exports = withNativeWind(config, { input: './src/global.css' });
