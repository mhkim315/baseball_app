const base = require("./app.json");

module.exports = () => {
  const isIOS = process.env.EAS_BUILD_PLATFORM === "ios";

  if (isIOS) {
    const plugins = base.expo.plugins || [];
    return {
      ...base,
      expo: {
        ...base.expo,
        plugins: plugins.filter((p) => {
          const name = Array.isArray(p) ? p[0] : p;
          return name !== "@react-native-firebase/app" && name !== "@react-native-firebase/messaging";
        }),
        ios: {
          ...base.expo.ios,
          googleServicesFile: undefined,
        },
      },
    };
  }

  return base;
};
