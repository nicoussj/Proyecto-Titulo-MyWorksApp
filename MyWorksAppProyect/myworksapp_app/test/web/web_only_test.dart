// Ramas solo-web (kIsWeb): se corren con `flutter test --platform chrome test/web`.
@TestOn('browser')
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/utils/app_error.dart';
import 'package:myworksapp/core/utils/constants.dart';
import 'package:myworksapp/core/utils/transbank_checkout.dart';
import 'package:myworksapp/core/utils/webpay_return_route.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:url_launcher_platform_interface/link.dart';
import 'package:url_launcher_platform_interface/url_launcher_platform_interface.dart';
import 'package:web/web.dart' as web;

class _FakeLauncher extends UrlLauncherPlatform with MockPlatformInterfaceMixin {
  bool answer = true;
  final List<(String, String?)> calls = [];

  @override
  LinkDelegate? get linkDelegate => null;

  @override
  Future<bool> launchUrl(String url, LaunchOptions options) async {
    calls.add((url, options.webOnlyWindowName));
    return answer;
  }
}

void _query(String query) {
  web.window.history.replaceState(null, '', '${web.window.location.pathname}$query');
}

void main() {
  final original = web.window.location.href;

  tearDown(() {
    web.window.history.replaceState(null, '', original);
    resetWebpayReturnRouteForTest();
  });

  group('openTransbankCheckout en web', () {
    late _FakeLauncher launcher;
    setUp(() {
      launcher = _FakeLauncher();
      UrlLauncherPlatform.instance = launcher;
    });

    test('navega la misma pestaña (_self)', () async {
      await openTransbankCheckout('https://webpay3gint.transbank.cl/pago');
      expect(launcher.calls.single, ('https://webpay3gint.transbank.cl/pago', '_self'));
    });

    test('si el navegador no navega avisa con error de red', () async {
      launcher.answer = false;
      await expectLater(
        openTransbankCheckout('https://webpay3gint.transbank.cl/pago'),
        throwsA(isA<AppError>().having((e) => e.message, 'message', 'No se pudo abrir Transbank')),
      );
    });
  });

  group('webpayReturnLocation en web', () {
    test('pago=ok con jobId abre el detalle del trabajo una sola vez', () {
      _query('?pago=ok&jobId=%20abc-123%20');
      expect(webpayReturnLocation(isLoggedIn: true), '${AppConstants.routeJobDetail}/abc-123');
      expect(webpayReturnLocation(isLoggedIn: true), isNull);
    });

    test('pago=retorno sin jobId va al historial', () {
      _query('?pago=retorno');
      expect(webpayReturnLocation(isLoggedIn: true), AppConstants.routeJobHistory);
    });

    test('sin sesión o con otro valor no redirige', () {
      _query('?pago=ok&jobId=abc');
      expect(webpayReturnLocation(isLoggedIn: false), isNull);
      _query('?pago=rechazado');
      expect(webpayReturnLocation(isLoggedIn: true), isNull);
    });
  });
}
