module.exports = {
  apps: [
    {
      name: 'lakonspaceways',
      script: 'server.js',
      cwd: __dirname,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
