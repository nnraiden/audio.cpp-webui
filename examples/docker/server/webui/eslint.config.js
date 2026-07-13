module.exports = [
  {
    files: ["server.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        Buffer: "readonly",
        URL: "readonly",
        __dirname: "readonly",
        console: "readonly",
        process: "readonly",
        require: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unreachable": "error",
      "no-unused-vars": "error",
    },
  },
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        File: "readonly",
        FormData: "readonly",
        URL: "readonly",
        console: "readonly",
        document: "readonly",
        fetch: "readonly",
        window: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unreachable": "error",
      "no-unused-vars": "error",
    },
  },
];
