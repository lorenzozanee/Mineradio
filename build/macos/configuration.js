'use strict';

const packageMetadata = require('../../package.json');

const UNSIGNED_LOCAL_BUILD = '1';

function createMacConfiguration(env = process.env) {
  if (env.CI === 'true' && env.MINERADIO_ALLOW_UNSIGNED_MACOS_BUILD === UNSIGNED_LOCAL_BUILD) {
    throw new Error('Unsigned macOS builds are limited to explicit local validation.');
  }
  const unsignedLocalBuild = env.MINERADIO_ALLOW_UNSIGNED_MACOS_BUILD === UNSIGNED_LOCAL_BUILD;
  const {
    afterPack,
    nsis,
    toolsets,
    win,
    ...sharedConfiguration
  } = packageMetadata.build;

  return {
    ...sharedConfiguration,
    directories: {
      ...sharedConfiguration.directories,
      output: 'dist-macos'
    },
    files: [
      ...sharedConfiguration.files,
      '!build/**/*',
      '!desktop/platform/windows/**/*',
      '!desktop/desktop-*-runtime.js',
      '!desktop/full-desktop-mode-runtime.js',
      '!desktop/wallpaper-engine-*.js',
      '!desktop/wallpaper-mode-runtime.js'
    ],
    afterPack: 'build/macos/after-pack.js',
    afterSign: 'build/macos/notarize.js',
    mac: {
      category: 'public.app-category.music',
      icon: 'build/icon.png',
      target: [
        {
          target: 'dmg',
          arch: ['arm64']
        }
      ],
      artifactName: 'Mineradio-${version}-macOS-arm64.${ext}',
      hardenedRuntime: true,
      entitlements: 'build/macos/entitlements.plist',
      entitlementsInherit: 'build/macos/entitlements.plist',
      extendInfo: {
        NSCameraUsageDescription: 'Mineradio 仅在你开启手势控制时使用摄像头。',
        NSCameraUseContinuityCameraDeviceType: true,
        NSMicrophoneUsageDescription: 'Mineradio 仅在你开启音频监测功能时使用麦克风。',
      },
      forceCodeSigning: !unsignedLocalBuild,
      notarize: false,
      ...(unsignedLocalBuild ? { identity: null } : {})
    },
    dmg: {
      artifactName: 'Mineradio-${version}-macOS-arm64.${ext}',
      sign: false,
      contents: [
        {
          x: 130,
          y: 220,
          type: 'file'
        },
        {
          x: 410,
          y: 220,
          type: 'link',
          path: '/Applications'
        }
      ]
    },
    publish: null
  };
}

module.exports = {
  createMacConfiguration,
  UNSIGNED_LOCAL_BUILD
};
