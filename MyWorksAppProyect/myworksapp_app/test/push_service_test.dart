// PushService sin la configuración FCM (la build normal y el CI): todo es un
// no-op y nunca llama a Supabase. Las ramas con FCM están en
// push_service_enabled_test.dart (se corre con --dart-define FCM_*).
import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/config/push_config.dart';
import 'package:myworksapp/core/services/push_service.dart';

import 'support/fake_supabase.dart';

void main() {
  test('sin FCM registrar y quitar el equipo no hacen nada', () async {
    final b = await setUpFakeSupabase(signedIn: true);
    b.requests.clear();
    await PushService.instance.register(fakeUserId);
    await PushService.instance.unregister();
    expect(b.requests.where((r) => r.path.contains('dispositivo_push')), isEmpty);
  }, skip: PushConfig.isConfigured ? 'build con FCM: ver push_service_enabled_test' : null);
}
