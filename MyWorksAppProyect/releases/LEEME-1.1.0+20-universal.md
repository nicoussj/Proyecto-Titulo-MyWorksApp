# MyWorksApp 1.1.0+20 — APK universal (instalación limpia)

| Campo | Valor |
|-------|--------|
| versionName | `1.1.0` (V1.1) |
| versionCode | `20` |
| Tipo | **Universal / fat** (`flutter build apk --release`, sin split-per-abi) |
| ABIs | armeabi-v7a + arm64-v8a + x86_64 |
| Tamaño | ~83M |
| Firma | **DEBUG** (Android Debug) |
| applicationId | `cl.myworksapp.app` |
| Incluye | Fix pantalla negra (#128) + fixes evidencias |

## Instalación limpia (obligatorio si hubo conflicto de firma)

1. Desinstalar cualquier My Works App previa: `cl.myworksapp.app`.
2. Instalar este APK (no es un update sobre builds con otra key DEBUG).

## Archivos en media

- `MyWorksApp-1.1.0+20-universal-release.apk` (nombre canónico)
- `MyWorksApp-V1.1-completa.apk` (mismo binario)

## SHA-256

```
f1680355afe00383fce505d1c14ae52fdf7822ae43829ceba60c76faf0c24505  MyWorksApp-1.1.0+20-universal-release.apk
```
