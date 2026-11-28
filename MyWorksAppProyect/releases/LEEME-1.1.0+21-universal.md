# MyWorksApp 1.1.0+21 — fix real pantalla negra (boot Supabase)

## Causa raíz (confirmada, no es SystemChrome)

Los APK **1.0.16+18 … 1.1.0+20** se compilaron **sin** `--dart-define-from-file=dart_defines.json`.

En release, `SupabaseConfig.validateForCurrentBuild()` hacía:

```dart
if (!_hasUrlDefine || !_hasAnonKeyDefine)
  throw StateError('Release build requires --dart-define=...');
```

Eso corría en `main()` **antes** de `runApp()` → Flutter nunca pintaba → solo LaunchTheme night (`Theme.Black`) = **pantalla negra**.

El APK **+17** que sí funcionaba **no** contiene esa cadena (tree-shake): se construyó **con** dart-defines (como indica `INSTALL.md`).

La hipótesis SystemChrome (#128) **no** era la causa: Gabriel siguió viendo negro con +20 tras ese “fix”.

## Fix en 1.1.0+21

1. `validateForCurrentBuild` solo exige URL/key no vacíos (defaults de demo OK).
2. `main()` **siempre** llama `runApp` (UI de fallo navy si el boot tira).
3. `Supabase.initialize` con timeout 20s (no hang eterno de red).
4. LaunchTheme night ya no usa `Theme.Black` (Light + splash drawable).
5. Splash Flutter: navy + «Cargando My Works App…» mientras AppInitializer corre.
6. Este APK se compiló con `--dart-define-from-file=dart_defines.json`.

## Evidencia estática en el binario (arm64 libapp.so)

| Check | +17 (OK) | +20 (negro) | +21 (este) |
|-------|----------|-------------|------------|
| String `Release build requires --dart-define` | ausente | **presente** | **ausente** |
| URL demo embebida | sí | sí | sí |
| UI «No se pudo iniciar My Works App» | — | — | sí |
| Splash UTF-16 «Cargando My Works App» | — | — | sí |

No hay emulador arm64 usable en este host x86_64 para logcat; la evidencia es comparación binaria +17/+20/+21 + unit test de validate.

## Instalación limpia (obligatoria)

1. Desinstalar `cl.myworksapp.app` por completo.
2. Instalar este APK (firma DEBUG del repo).
3. Al abrir debe verse splash navy / onboarding — **no** negro puro.

## Archivos en media store

- `MyWorksApp-1.1.0+21-universal-release.apk` (canónico)
- `MyWorksApp-V1.1-limpia-universal.apk` / `MyWorksApp-V1.1-completa.apk` (mismo binario)

## SHA-256

```
866a00df057eeb73ddab0abe9c73268abec9551478219d9950bc2e6686f4a4cb  MyWorksApp-1.1.0+21-universal-release.apk
```

Tamaño ~84–87M · versionName `1.1.0` · versionCode `21` · fat (arm64 + armeabi-v7a + x86_64)
