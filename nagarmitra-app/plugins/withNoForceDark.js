// Some Android skins (MIUI/HyperOS, One UI, OxygenOS, ColorOS…) can force dark
// mode onto apps. That recolours our dark text light while white input boxes
// stay white, making typed text invisible. This app is designed light-only,
// so opt out of forced darkening in the main theme.
const { withAndroidStyles, AndroidConfig } = require('expo/config-plugins');

module.exports = function withNoForceDark(config) {
  return withAndroidStyles(config, (cfg) => {
    cfg.modResults = AndroidConfig.Styles.assignStylesValue(cfg.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'android:forceDarkAllowed',
      value: 'false',
    });
    return cfg;
  });
};
