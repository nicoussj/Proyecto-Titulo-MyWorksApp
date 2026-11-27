// Las fakes usan las interfaces de plataforma que ya trae cada plugin.
// ignore_for_file: depend_on_referenced_packages
// Apertura del handoff de Transbank: valida la URL y respeta lo que responde
// url_launcher. No toca la lógica de cobro: solo cómo se abre la página.
import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/utils/app_error.dart';
import 'package:myworksapp/core/utils/transbank_checkout.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:url_launcher_platform_interface/link.dart';
import 'package:url_launcher_platform_interface/url_launcher_platform_interface.dart';

class _FakeLauncher extends UrlLauncherPlatform with MockPlatformInterfaceMixin {
  bool answer = true;
  final List<(String, PreferredLaunchMode, String?)> calls = [];

  @override
  LinkDelegate? get linkDelegate => null;

  @override
  Future<bool> canLaunch(String url) async => true;

  @override
  Future<bool> launchUrl(String url, LaunchOptions options) async {
    calls.add((url, options.mode, options.webOnlyWindowName));
    return answer;
  }
}

void main() {
  late _FakeLauncher launcher;

  setUp(() {
    launcher = _FakeLauncher();
    UrlLauncherPlatform.instance = launcher;
  });

  test('abre https en una app externa', () async {
    await openTransbankCheckout('https://webpay3gint.transbank.cl/pago?token=t');
    expect(launcher.calls.single.$1, 'https://webpay3gint.transbank.cl/pago?token=t');
    expect(launcher.calls.single.$2, PreferredLaunchMode.externalApplication);
  });

  test('si el sistema no la abre avisa con error de red', () async {
    launcher.answer = false;
    await expectLater(
      openTransbankCheckout('https://webpay3gint.transbank.cl/pago'),
      throwsA(isA<AppError>().having((e) => e.message, 'message', 'No se pudo abrir Transbank')),
    );
  });

  test('rechaza http, esquemas raros y texto que no es URL', () async {
    for (final url in ['http://webpay3gint.transbank.cl', 'javascript:alert(1)', '::no-es-url', '']) {
      await expectLater(
        openTransbankCheckout(url),
        throwsA(isA<AppError>().having((e) => e.message, 'message', 'URL de pago inválida')),
        reason: url,
      );
    }
    expect(launcher.calls, isEmpty);
  });
}
