import 'package:flutter/foundation.dart';

/// Configuración del backend Supabase.
///
/// Preferir `--dart-define=SUPABASE_URL=...` y
/// `--dart-define=SUPABASE_ANON_KEY=...` (o `--dart-define-from-file=dart_defines.json`)
/// en builds de release. Los valores por defecto mantienen la demo usable.
///
/// NUNCA coloques aquí la `service_role` / secret key.
class SupabaseConfig {
  SupabaseConfig._();

  static const bool _hasUrlDefine = bool.hasEnvironment('SUPABASE_URL');
  static const bool _hasAnonKeyDefine =
      bool.hasEnvironment('SUPABASE_ANON_KEY');

  static const String url = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://wxqrfcqifkfgawrnqmnj.supabase.co',
  );

  static const String publishableKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: 'sb_publishable_WN_cTANRJ4nCuPw_6HWd7w_iDJjRA8O',
  );

  /// true si el build compiló con dart-defines explícitos.
  static bool get hasDartDefines => _hasUrlDefine && _hasAnonKeyDefine;

  /// Valida URL/key. **No** exige dart-defines: en 1.0.16+18…+20 un release
  /// sin `--dart-define-from-file` tiraba StateError en [main] *antes* de
  /// [runApp] y la Activity quedaba en LaunchTheme negro (pantalla negra).
  ///
  /// Solo falla si URL o key quedaron vacíos.
  static void validateForCurrentBuild() {
    if (url.trim().isEmpty || publishableKey.trim().isEmpty) {
      throw StateError(
        'Falta SUPABASE_URL o SUPABASE_ANON_KEY. '
        'Compila con --dart-define-from-file=dart_defines.json',
      );
    }
  }
}
