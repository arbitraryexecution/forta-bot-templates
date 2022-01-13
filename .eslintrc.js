module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    jest: true,
    node: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 13,
  },
  rules: {
  },
  overrides: [
    {
      files: '*',
      rules: {
        'no-console': 'off'
      }
    }
  ]
};
