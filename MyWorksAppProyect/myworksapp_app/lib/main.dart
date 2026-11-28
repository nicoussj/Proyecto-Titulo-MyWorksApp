import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/utils/platform_support.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/config/supabase_config.dart';
import 'core/config/supabase_http_client.dart';
import 'core/theme/app_colors.dart';
import 'core/utils/app_logger.dart';
import 'app.dart';

/// Punto de entrada de la aplicación.
///
/// Orden: binding → (best-effort init) → **siempre** [runApp].
/// Nunca dejar que un throw previo a [runApp] deje solo el LaunchTheme negro.
void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  Object? bootError;
  StackTrace? bootStack;

  try {
    if (AppPlatform.isMobileNative) {
      await SystemChrome.setPreferredOrientations([
        DeviceOrientation.portraitUp,
        DeviceOrientation.portraitDown,
        DeviceOrientation.landscapeLeft,
        DeviceOrientation.landscapeRight,
      ]);
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    }

    await initializeDateFormatting('es_CL', null);

    AppLogger.i('Iniciando MyWorksApp...');
    if (!SupabaseConfig.hasDartDefines) {
      AppLogger.w(
        'Release sin --dart-define-from-file=dart_defines.json; '
        'usando defaults de demo embebidos.',
      );
    }

    SupabaseConfig.validateForCurrentBuild();

    // Timeout: un hang de red en initialize() nunca debe bloquear runApp
    // (LaunchTheme / pantalla negra eterna).
    await Supabase.initialize(
      url: SupabaseConfig.url,
      publishableKey: SupabaseConfig.publishableKey,
      httpClient: createSupabaseHttpClient(),
      authOptions: const FlutterAuthClientOptions(
        authFlowType: AuthFlowType.pkce,
      ),
    ).timeout(const Duration(seconds: 20));
    AppLogger.i('Supabase inicializado');
  } catch (e, st) {
    bootError = e;
    bootStack = st;
    AppLogger.e('Error en el arranque (se muestra UI de fallo)', e, st);
  }

  // Siempre pintar: MyWorksApp (splash navy) o UI de fallo explícita.
  runApp(
    ProviderScope(
      child: bootError == null
          ? const MyWorksApp()
          : _BootFailureApp(error: bootError, stackTrace: bootStack),
    ),
  );
}

/// Pantalla visible si algo falla antes del árbol normal (nunca pantalla negra).
class _BootFailureApp extends StatelessWidget {
  const _BootFailureApp({required this.error, this.stackTrace});

  final Object error;
  final StackTrace? stackTrace;

  @override
  Widget build(BuildContext context) {
    final message = error.toString().replaceFirst('Bad state: ', '');
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: AppColors.brandNavy,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 24),
                const Icon(Icons.error_outline, color: AppColors.brandOrange, size: 48),
                const SizedBox(height: 16),
                const Text(
                  'No se pudo iniciar My Works App',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white70),
                ),
                const SizedBox(height: 24),
                const Text(
                  'Si acabas de instalar un APK de prueba, desinstala '
                  'cl.myworksapp.app y vuelve a instalar el build con '
                  'dart_defines (V1.1 limpia).',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white54, fontSize: 13),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
