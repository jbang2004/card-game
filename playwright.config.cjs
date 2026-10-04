const { defineConfig } = require("@playwright/test");
// PW_PORT lets two checkouts (or a stray server on 8000) run side by side; tools/serve.py explains the server.
const port = Number(process.env.PW_PORT) || 8000;
module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 45000,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "artifacts/qa/results.json" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}/dist/`,
    viewport: { width: 1600, height: 940 },
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ||
        (process.platform === "darwin"
          ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
          : undefined),
    },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `python3 tools/serve.py ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
  },
});
