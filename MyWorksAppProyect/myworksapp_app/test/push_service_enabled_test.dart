// Las fakes usan las interfaces de plataforma que ya trae cada plugin.
// ignore_for_file: depend_on_referenced_packages
// PushService con FCM configurado y Firebase falso. Solo corre con:
//   flutter test test/push_service_enabled_test.dart \
//     --dart-define=FCM_API_KEY=test --dart-define=FCM_APP_ID=1:1:android:1 \
//     --dart-define=FCM_SENDER_ID=1 --dart-define=FCM_PROJECT_ID=test
// Los valores son de prueba: Firebase y Supabase son falsos, nada sale a la red.
import 'dart:async';

import 'package:firebase_core_platform_interface/test.dart';
import 'package:firebase_messaging_platform_interface/firebase_messaging_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/config/push_config.dart';
import 'package:myworksapp/core/services/push_service.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';

import 'support/fake_supabase.dart';

class _FailingCore implements TestFirebaseCoreHostApi {
  @override
  Future<CoreInitializeResponse> initializeApp(String a, CoreFirebaseOptions o) =>
      Future.error(Exception('sin google play services'));
  @override
  Future<List<CoreInitializeResponse>> initializeCore() async => [];
  @override
  Future<CoreFirebaseOptions> optionsFromResource() =>
      Future.error(Exception('sin opciones'));
}

/// Como un Android sin google-services.json: no hay app por defecto hasta
/// que PushService la crea con las opciones del --dart-define.
class _OkCore implements TestFirebaseCoreHostApi {
  @override
  Future<CoreInitializeResponse> initializeApp(String a, CoreFirebaseOptions o) async =>
      CoreInitializeResponse(name: a, options: o, pluginConstants: {});
  @override
  Future<List<CoreInitializeResponse>> initializeCore() async => [];
  @override
  Future<CoreFirebaseOptions> optionsFromResource() =>
      Future.error(Exception('sin google-services.json'));
}

const _settings = NotificationSettings(
  alert: AppleNotificationSetting.enabled,
  announcement: AppleNotificationSetting.disabled,
  authorizationStatus: AuthorizationStatus.authorized,
  badge: AppleNotificationSetting.enabled,
  carPlay: AppleNotificationSetting.disabled,
  lockScreen: AppleNotificationSetting.enabled,
  notificationCenter: AppleNotificationSetting.enabled,
  showPreviews: AppleShowPreviewSetting.always,
  timeSensitive: AppleNotificationSetting.disabled,
  criticalAlert: AppleNotificationSetting.disabled,
  sound: AppleNotificationSetting.enabled,
  providesAppNotificationSettings: AppleNotificationSetting.disabled,
);

class _FakeMessaging extends FirebaseMessagingPlatform
    with MockPlatformInterfaceMixin {
  AuthorizationStatus status = AuthorizationStatus.authorized;
  String? token = 'token-equipo-1';
  bool failToken = false;
  final refresh = StreamController<String>.broadcast();
  int permissionRequests = 0;

  @override
  FirebaseMessagingPlatform delegateFor({required app}) => this;

  @override
  FirebaseMessagingPlatform setInitialValues({bool? isAutoInitEnabled}) => this;

  @override
  Future<NotificationSettings> requestPermission({
    bool alert = true,
    bool announcement = false,
    bool badge = true,
    bool carPlay = false,
    bool criticalAlert = false,
    bool provisional = false,
    bool sound = true,
    bool providesAppNotificationSettings = false,
  }) async {
    permissionRequests++;
    return NotificationSettings(
      alert: _settings.alert,
      announcement: _settings.announcement,
      authorizationStatus: status,
      badge: _settings.badge,
      carPlay: _settings.carPlay,
      lockScreen: _settings.lockScreen,
      notificationCenter: _settings.notificationCenter,
      showPreviews: _settings.showPreviews,
      timeSensitive: _settings.timeSensitive,
      criticalAlert: _settings.criticalAlert,
      sound: _settings.sound,
      providesAppNotificationSettings: _settings.providesAppNotificationSettings,
    );
  }

  @override
  Future<String?> getToken({String? vapidKey, String? serviceWorkerScriptPath}) async {
    if (failToken) throw Exception('sin token');
    return token;
  }

  @override
  Stream<String> get onTokenRefresh => refresh.stream;
}

final messaging = _FakeMessaging();

List<Map<String, dynamic>> _rpc(FakeBackend b, String name) => [
      for (final r in b.requests)
        if (r.path.endsWith('/rpc/$name')) Map<String, dynamic>.from(r.json as Map),
    ];

void main() {
  final skip = PushConfig.isConfigured ? null : 'requiere --dart-define FCM_* (ver cabecera)';
  late FakeBackend b;

  setUp(() async {
    b = await setUpFakeSupabase(signedIn: true);
    FirebaseMessagingPlatform.instance = messaging;
    messaging
      ..status = AuthorizationStatus.authorized
      ..token = 'token-equipo-1'
      ..failToken = false;
  });

  group('PushService con FCM', skip: skip, () {
    test('si Firebase no inicia, sigue sin push y sin llamar a Supabase', () async {
      TestFirebaseCoreHostApi.setUp(_FailingCore());
      await PushService.instance.register(fakeUserId);
      expect(_rpc(b, 'registrar_dispositivo_push'), isEmpty);
      await PushService.instance.unregister();
      expect(_rpc(b, 'quitar_dispositivo_push'), isEmpty);
    });

    test('sin permiso de notificaciones no guarda el token', () async {
      TestFirebaseCoreHostApi.setUp(_OkCore());
      messaging.status = AuthorizationStatus.denied;
      final before = messaging.permissionRequests;
      await PushService.instance.register(fakeUserId);
      expect(messaging.permissionRequests, before + 1);
      expect(_rpc(b, 'registrar_dispositivo_push'), isEmpty);
    });

    test('guarda el token, lo renueva y al cerrar sesión lo quita', () async {
      await PushService.instance.register(fakeUserId);
      expect(_rpc(b, 'registrar_dispositivo_push'), [
        {'p_token': 'token-equipo-1', 'p_plataforma': 'android'},
      ]);
      messaging.refresh.add('token-equipo-2');
      await pumpEventQueue();
      expect(_rpc(b, 'registrar_dispositivo_push').last['p_token'], 'token-equipo-2');

      // Registrar de nuevo reemplaza la suscripción anterior.
      await PushService.instance.register(fakeUserId);
      expect(_rpc(b, 'registrar_dispositivo_push'), hasLength(3));

      await PushService.instance.unregister();
      expect(_rpc(b, 'quitar_dispositivo_push'), [
        {'p_token': 'token-equipo-1'},
      ]);
      // Ya sin token, quitar de nuevo no llama a Supabase.
      await PushService.instance.unregister();
      expect(_rpc(b, 'quitar_dispositivo_push'), hasLength(1));
    });

    test('sin token no llama a Supabase', () async {
      messaging.token = null;
      await PushService.instance.register(fakeUserId);
      expect(_rpc(b, 'registrar_dispositivo_push'), isEmpty);
    });

    test('si Supabase falla al guardar o quitar, la app sigue', () async {
      b.failing.addAll(['registrar_dispositivo_push', 'quitar_dispositivo_push']);
      await PushService.instance.register(fakeUserId);
      await PushService.instance.unregister();
      expect(_rpc(b, 'quitar_dispositivo_push'), hasLength(1));
    });

    test('si FCM no entrega token, lo registra en el log y sigue', () async {
      messaging.failToken = true;
      await PushService.instance.register(fakeUserId);
      expect(_rpc(b, 'registrar_dispositivo_push'), isEmpty);
    });
  });
}
