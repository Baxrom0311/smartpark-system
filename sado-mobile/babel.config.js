module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }]],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': './',
            '@/components': './components',
            '@/services': './services',
            '@/stores': './stores',
            '@/hooks': './hooks',
            '@/i18n': './i18n',
          },
        },
      ],
      // react-native-reanimated/plugin must be listed last.
      'react-native-reanimated/plugin',
    ],
  };
};
