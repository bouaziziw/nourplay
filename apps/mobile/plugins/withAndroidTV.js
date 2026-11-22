const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to add Android TV / Google TV support:
 * 1. Leanback & Touchscreen features
 * 2. LEANBACK_LAUNCHER category in MainActivity intent-filter
 * 3. android:banner attribute on <application>
 * 4. Copies the 320x180 banner asset to android drawable resources
 */
function withAndroidTV(config, options = {}) {
  const bannerSource = options.banner || './assets/tv-banner.png';

  // 1. Update AndroidManifest.xml
  config = withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    const app = manifest.application?.[0];

    if (!app) return modConfig;

    // Set banner attribute on application
    app.$['android:banner'] = '@drawable/tv_banner';

    // Ensure uses-feature list exists
    if (!manifest['uses-feature']) {
      manifest['uses-feature'] = [];
    }

    const featuresToAdd = [
      { name: 'android.software.leanback', required: 'false' },
      { name: 'android.hardware.touchscreen', required: 'false' },
      { name: 'android.hardware.faketouch', required: 'false' },
      { name: 'android.hardware.telephony', required: 'false' },
      { name: 'android.hardware.camera', required: 'false' },
      { name: 'android.hardware.camera.autofocus', required: 'false' },
      { name: 'android.hardware.microphone', required: 'false' },
    ];

    for (const feat of featuresToAdd) {
      const existing = manifest['uses-feature'].find(
        (f) => f.$ && f.$['android:name'] === feat.name
      );
      if (existing) {
        existing.$['android:required'] = feat.required;
      } else {
        manifest['uses-feature'].push({
          $: {
            'android:name': feat.name,
            'android:required': feat.required,
          },
        });
      }
    }

    // Add LEANBACK_LAUNCHER category to MainActivity
    const activities = app.activity || [];
    const mainActivity = activities.find((a) => {
      const name = a.$?.['android:name'];
      return name === '.MainActivity' || name?.endsWith('.MainActivity');
    });

    if (mainActivity) {
      if (!mainActivity['intent-filter']) {
        mainActivity['intent-filter'] = [];
      }

      // Check if LEANBACK_LAUNCHER is already present
      let hasLeanbackCategory = false;
      for (const filter of mainActivity['intent-filter']) {
        const categories = filter.category || [];
        if (categories.some((c) => c.$?.['android:name'] === 'android.intent.category.LEANBACK_LAUNCHER')) {
          hasLeanbackCategory = true;
          break;
        }
      }

      if (!hasLeanbackCategory) {
        // Find main launcher intent filter or create new one
        const mainFilter = mainActivity['intent-filter'].find((filter) => {
          const actions = filter.action || [];
          return actions.some((a) => a.$?.['android:name'] === 'android.intent.action.MAIN');
        });

        if (mainFilter) {
          if (!mainFilter.category) mainFilter.category = [];
          mainFilter.category.push({
            $: { 'android:name': 'android.intent.category.LEANBACK_LAUNCHER' },
          });
        } else {
          mainActivity['intent-filter'].push({
            action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
            category: [
              { $: { 'android:name': 'android.intent.category.LAUNCHER' } },
              { $: { 'android:name': 'android.intent.category.LEANBACK_LAUNCHER' } },
            ],
          });
        }
      }
    }

    return modConfig;
  });

  // 2. Copy the banner file to android/app/src/main/res/drawable/tv_banner.png
  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const srcPath = path.resolve(projectRoot, bannerSource);
      const resDir = path.resolve(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'res',
        'drawable'
      );

      if (fs.existsSync(srcPath)) {
        fs.mkdirSync(resDir, { recursive: true });
        const destPath = path.join(resDir, 'tv_banner.png');
        fs.copyFileSync(srcPath, destPath);
      }
      return modConfig;
    },
  ]);

  return config;
}

module.exports = withAndroidTV;
