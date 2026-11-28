# MyWorksApp 1.1.0+19 — fix pantalla negra (+ evidencias)

| Campo | Valor |
|-------|--------|
| versionName | `1.1.0` (V1.1) |
| versionCode (pubspec) | `19` (`1.1.0+19`) |
| versionCode arm64 (split) | `2019` |
| ABI | arm64-v8a |
| Base main al build | `a47ef457f7a2f4eb002c60ea40ed357bc0fa127e` + fix SystemChrome cámara |
| Compilación | 2026-11-28 (America/Santiago), `flutter clean && flutter build apk --release --split-per-abi` |
| Firma | **DEBUG** |

## Causa raíz (1.0.16+18)

`EvidenceShutterCameraPage` llamaba `SystemChrome.setPreferredOrientations([portraitUp])` al abrir y restauraba en `dispose`. Eso muta la **Activity** global. En algunos equipos, tras instalar +18, el arranque quedó en pantalla negra (LaunchTheme night = negro) sin pintar Flutter. El fix quita SystemChrome de la cámara; solo usa `lockCaptureOrientation` + preview AspectRatio. Splash de init ahora es navy + texto «Cargando…».

## Archivo

`MyWorksApp-1.1.0+19-arm64-v8a-release.apk`

## SHA-256

```
16ce04e27c670cb6affb4144645c6aee2b7d9a88d573b54f99f6731c20e64b4d  MyWorksApp-1.1.0+19-arm64-v8a-release.apk
```

Si no instala encima de +17/+18, desinstala `cl.myworksapp.app` primero.
