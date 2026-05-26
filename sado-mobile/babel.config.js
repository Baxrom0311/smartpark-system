module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
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
      'react-native-reanimated/plugin',
    ],
  };
};
