# Generated Manifest

Do not upload these paths to GitHub. They are recreated automatically by install, prebuild, compile, runtime, or local tools.

## Generated Or Local-State Paths

- `node_modules/`
- `.expo/`
- `dist/`
- `generated/`
- `.cursor/`
- `.gradle-local/`
- `.idea/`
- `.vscode/`
- `.zed/`
- `CustomBiteSuite-release.apk`
- `android/.gradle/`
- `android/.kotlin/`
- `android/app/.cxx/`
- `android/app/build/`
- `android/build/`
- `android/`
  This entire folder is treated as generated in the current repository model because it is ignored and can be recreated by Expo prebuild.

## Regeneration Triggers

- `npm install` recreates `node_modules/`
- `expo start` recreates `.expo/`
- `expo export` recreates `dist/`
- `npx expo prebuild -p android` recreates `android/`
- Gradle build commands recreate Android build caches and APK outputs
- IDE/editor launches recreate local metadata folders
