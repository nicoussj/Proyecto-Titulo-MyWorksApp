# MyWorksApp 1.0.16+17 — APK de prueba

> Los `.apk` **no** se versionan en git (`MyWorksAppProyect/.gitignore` ignora `*.apk`).
> Se publican en [GitHub Releases](https://github.com/nicoussj/Proyecto-Titulo-MyWorksApp/releases).

| Campo | Valor |
|-------|--------|
| versionName | `1.0.16` |
| versionCode (pubspec) | `17` (`1.0.16+17`) |
| versionCode arm64 (split) | `2017` |
| applicationId | `cl.myworksapp.app` |
| Commit de `main` | `995eddc4082c8d798421edc9b107ceda239bbe86` |
| Compilación | 2026-11-28 (America/Santiago), `flutter build apk --release --split-per-abi` |
| Firma | **DEBUG** (sin `android/key.properties` / keystore release en el entorno de build) |

## Descarga

Release: **https://github.com/nicoussj/Proyecto-Titulo-MyWorksApp/releases/tag/v1.0.16-17-20261128**

- **Teléfonos (recomendado):** `MyWorksApp-1.0.16+17-arm64-v8a.apk`
- Android 32 bits: `MyWorksApp-1.0.16+17-armeabi-v7a.apk`
- Emuladores x86_64: `MyWorksApp-1.0.16+17-x86_64.apk`

## SHA-256

```
c53707e752c346d7694d59598bbceb01e916b3e7131c2da127087a7b6b40fd68  MyWorksAppProyect/releases/MyWorksApp-1.0.16+17-arm64-v8a.apk
8d8ea903ce76e296898ebd03b97dfbafbcb46960ffcf75f914ea702fd395ae54  MyWorksAppProyect/releases/MyWorksApp-1.0.16+17-armeabi-v7a.apk
93256febf316052ece8b291b6285988b29043bfcc58ddf81ab258caabe44205c  MyWorksAppProyect/releases/MyWorksApp-1.0.16+17-x86_64.apk
```

Si no instala encima de una APK anterior (firma distinta o id `com.example.myworksapp`), desinstala primero; los datos están en Supabase.
