import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/config/demo_credentials.dart';

void main() {
  test('las credenciales de depuración apuntan a las cuentas del seed vigente', () {
    final emails = [
      DemoCredentials.userEmail,
      DemoCredentials.adminEmail,
      DemoCredentials.workerEmail,
      ...DemoCredentials.extraWorkerEmails,
    ];
    for (final email in emails) {
      expect(email, endsWith('@demo.myworksapp.cl'));
    }
    expect(DemoCredentials.demoPassword, 'Demo2026!');
    expect(emails.any((e) => e.endsWith('@demo.com')), isFalse);
    expect(
      DemoCredentials.isDemoEmail('ricardo.cheuquepan@demo.myworksapp.cl'),
      isTrue,
    );
    expect(DemoCredentials.isDemoEmail('alguien@gmail.com'), isFalse);
  });
}
