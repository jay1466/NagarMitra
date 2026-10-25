// Extends app.json. On EAS the Firebase Android config arrives as the secret
// file variable GOOGLE_SERVICES_JSON; locally it is ./google-services.json (git-ignored).
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
});
