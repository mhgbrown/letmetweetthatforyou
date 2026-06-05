module.exports = [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        process: "readonly",
        console: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        require: "readonly",
        module: "readonly",
        __dirname: "readonly",
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        before: "readonly",
        after: "readonly"
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error"
    },
  },
];
