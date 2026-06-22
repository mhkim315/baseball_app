const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withModularHeaders(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      let content = fs.readFileSync(podfilePath, "utf8");
      // Add use_modular_headers! before the target section
      if (!content.includes("use_modular_headers!")) {
        content = content.replace(/(target\s+['"]app['"])/, "use_modular_headers!\n$1");
      }
      fs.writeFileSync(podfilePath, content);
      return cfg;
    },
  ]);
}

module.exports = withModularHeaders;
