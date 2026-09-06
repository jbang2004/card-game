const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 45000,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "artifacts/qa/results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:8000/dist/",
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
    command: "python3 -m http.server 8000 --bind 127.0.0.1",
    url: "http://127.0.0.1:8000",
    reuseExistingServer: true,
  },
});
