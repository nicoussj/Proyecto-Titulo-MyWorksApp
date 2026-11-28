// Las fakes usan las interfaces de plataforma que ya trae cada plugin.
// ignore_for_file: depend_on_referenced_packages
// Cámara de evidencia (toque = foto, mantener = video) contra una cámara y
// permisos falsos: cubre permisos negados, sin cámara, foto, video corto,
// video válido y los errores del plugin, sin hardware real.
import 'dart:async';

import 'package:camera_platform_interface/camera_platform_interface.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/features/jobs/presentation/pages/evidence_shutter_camera_page.dart';
import 'package:myworksapp/features/jobs/presentation/widgets/evidence_shutter_button.dart';
import 'package:permission_handler_platform_interface/permission_handler_platform_interface.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';

class _FakePermissions extends PermissionHandlerPlatform
    with MockPlatformInterfaceMixin {
  PermissionStatus camera = PermissionStatus.granted;
  PermissionStatus microphone = PermissionStatus.granted;

  @override
  Future<Map<Permission, PermissionStatus>> requestPermissions(
    List<Permission> permissions,
  ) async =>
      {
        for (final p in permissions)
          p: p == Permission.camera ? camera : microphone,
      };
}

class _FakeCamera extends CameraPlatform with MockPlatformInterfaceMixin {
  List<CameraDescription> cameras = const [
    CameraDescription(
      name: 'front',
      lensDirection: CameraLensDirection.front,
      sensorOrientation: 0,
    ),
    CameraDescription(
      name: 'back',
      lensDirection: CameraLensDirection.back,
      sensorOrientation: 90,
    ),
  ];
  bool failPicture = false;
  bool failStart = false;
  bool failStop = false;
  int disposed = 0;
  Completer<void>? holdInit;
  String? createdWith;
  final _init = StreamController<CameraInitializedEvent>.broadcast();
  final _errors = StreamController<CameraErrorEvent>.broadcast();

  @override
  Future<List<CameraDescription>> availableCameras() async => cameras;

  @override
  Future<int> createCameraWithSettings(
    CameraDescription cameraDescription,
    MediaSettings mediaSettings,
  ) async {
    createdWith = cameraDescription.name;
    return 1;
  }

  @override
  Stream<CameraInitializedEvent> onCameraInitialized(int cameraId) =>
      _init.stream;

  @override
  Stream<CameraErrorEvent> onCameraError(int cameraId) => _errors.stream;

  @override
  Stream<DeviceOrientationChangedEvent> onDeviceOrientationChanged() =>
      const Stream.empty();

  @override
  Future<void> initializeCamera(
    int cameraId, {
    ImageFormatGroup imageFormatGroup = ImageFormatGroup.unknown,
  }) async {
    if (holdInit != null) await holdInit!.future;
    scheduleMicrotask(() => _init.add(const CameraInitializedEvent(
          1,
          1280,
          720,
          ExposureMode.auto,
          true,
          FocusMode.auto,
          true,
        )));
  }

  @override
  Widget buildPreview(int cameraId) => const ColoredBox(color: Colors.grey);

  @override
  Future<XFile> takePicture(int cameraId) async {
    if (failPicture) throw CameraException('foto', 'falló');
    return XFile('/tmp/evidencia.jpg');
  }

  @override
  Future<void> startVideoCapturing(VideoCaptureOptions options) async {
    if (failStart) throw CameraException('video', 'falló');
  }

  @override
  Future<XFile> stopVideoRecording(int cameraId) async {
    if (failStop) throw CameraException('stop', 'falló');
    return XFile('/tmp/evidencia.mp4');
  }

  @override
  Future<void> dispose(int cameraId) async => disposed++;

  DeviceOrientation? lockedOrientation;

  @override
  Future<void> lockCaptureOrientation(
    int cameraId,
    DeviceOrientation orientation,
  ) async {
    lockedOrientation = orientation;
  }

  @override
  Future<void> unlockCaptureOrientation(int cameraId) async {
    lockedOrientation = null;
  }
}

// Las fakes son privadas del archivo; las variables solo se usan aquí.
// ignore: library_private_types_in_public_api
late _FakeCamera camera;
// ignore: library_private_types_in_public_api
late _FakePermissions permissions;

/// Abre la cámara desde un botón para poder leer lo que devuelve al cerrar.
Future<List<EvidenceCapture?>> _open(WidgetTester tester) async {
  final results = <EvidenceCapture?>[];
  await tester.pumpWidget(MaterialApp(
    home: Builder(
      builder: (context) => Scaffold(
        body: TextButton(
          onPressed: () async {
            results.add(await Navigator.of(context).push<EvidenceCapture>(
              MaterialPageRoute(
                  builder: (_) => const EvidenceShutterCameraPage()),
            ));
          },
          child: const Text('abrir'),
        ),
      ),
    ),
  ));
  await tester.tap(find.text('abrir'));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pump();
  return results;
}

Future<TestGesture> _hold(WidgetTester tester) async {
  final gesture = await tester.startGesture(
    tester.getCenter(find.byKey(EvidenceShutterButton.shutterKey)),
  );
  await tester.pump(kLongPressTimeout + const Duration(milliseconds: 50));
  await tester.pump();
  return gesture;
}

void main() {
  setUp(() {
    camera = _FakeCamera();
    permissions = _FakePermissions();
    CameraPlatform.instance = camera;
    PermissionHandlerPlatform.instance = permissions;
  });

  testWidgets('sin permiso de cámara muestra el aviso', (tester) async {
    permissions.camera = PermissionStatus.denied;
    await _open(tester);
    expect(
      find.text('Se necesita el permiso de cámara para la evidencia.'),
      findsOneWidget,
    );
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets('sin micrófono no deja grabar', (tester) async {
    permissions.microphone = PermissionStatus.permanentlyDenied;
    await _open(tester);
    expect(
      find.text('Se necesita el micrófono para grabar el video de evidencia.'),
      findsOneWidget,
    );
  });

  testWidgets('sin cámaras disponibles avisa', (tester) async {
    camera.cameras = const [];
    await _open(tester);
    expect(
      find.text('Este dispositivo no tiene una cámara disponible.'),
      findsOneWidget,
    );
  });

  testWidgets('sin cámara trasera usa la primera', (tester) async {
    camera.cameras = const [
      CameraDescription(
        name: 'solo-frontal',
        lensDirection: CameraLensDirection.front,
        sensorOrientation: 0,
      ),
    ];
    await _open(tester);
    expect(camera.createdWith, 'solo-frontal');
  });

  testWidgets('bloquea la captura en portrait al abrir', (tester) async {
    await _open(tester);
    expect(camera.lockedOrientation, DeviceOrientation.portraitUp);
  });

  testWidgets('toque toma una foto y la devuelve', (tester) async {
    final results = await _open(tester);
    expect(camera.createdWith, 'back');
    expect(find.text('Toca para foto · mantén para video'), findsOneWidget);
    await tester.tap(find.byKey(EvidenceShutterButton.shutterKey));
    await tester.pumpAndSettle();
    expect(results.single!.isVideo, isFalse);
    expect(results.single!.file.path, '/tmp/evidencia.jpg');
    expect(camera.disposed, 1);
  });

  testWidgets('si la foto falla lo informa y sigue abierta', (tester) async {
    camera.failPicture = true;
    await _open(tester);
    await tester.tap(find.byKey(EvidenceShutterButton.shutterKey));
    await tester.pump();
    await tester.pump();
    expect(find.text('No se pudo tomar la foto.'), findsOneWidget);
  });

  testWidgets('cerrar sin capturar devuelve null', (tester) async {
    final results = await _open(tester);
    await tester.tap(find.byTooltip('Cerrar'));
    await tester.pumpAndSettle();
    expect(results.single, isNull);
  });

  testWidgets('video demasiado corto se descarta con aviso', (tester) async {
    await _open(tester);
    final gesture = await _hold(tester);
    expect(find.text('Suelta para detener (máx. 30 s)'), findsOneWidget);
    expect(find.text('REC'), findsOneWidget);
    expect(find.text('00:00'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 250));
    await gesture.up();
    await tester.pump();
    await tester.pump();
    expect(find.textContaining('El video es demasiado corto'), findsOneWidget);
    expect(find.text('Toca para foto · mantén para video'), findsOneWidget);
  });

  testWidgets('video de más de un segundo se devuelve con su duración',
      (tester) async {
    final results = await _open(tester);
    final gesture = await _hold(tester);
    // El cronómetro de la página mide tiempo real.
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 1100)),
    );
    await tester.pump(const Duration(milliseconds: 250));
    await gesture.up();
    await tester.pumpAndSettle();
    final capture = results.single!;
    expect(capture.isVideo, isTrue);
    expect(capture.file.path, '/tmp/evidencia.mp4');
    expect(capture.duration! >= const Duration(seconds: 1), isTrue);
  });

  testWidgets('si no puede empezar a grabar lo informa', (tester) async {
    camera.failStart = true;
    await _open(tester);
    final gesture = await _hold(tester);
    expect(find.text('No se pudo empezar a grabar.'), findsOneWidget);
    await gesture.up();
    await tester.pump();
  });

  testWidgets('si no puede detener la grabación lo informa', (tester) async {
    camera.failStop = true;
    await _open(tester);
    final gesture = await _hold(tester);
    await gesture.up();
    await tester.pump();
    await tester.pump();
    expect(find.text('No se pudo detener la grabación.'), findsOneWidget);
  });

  testWidgets('cerrar mientras abre la cámara libera el controlador',
      (tester) async {
    camera.holdInit = Completer<void>();
    await tester
        .pumpWidget(const MaterialApp(home: EvidenceShutterCameraPage()));
    await tester.pump();
    await tester.pumpWidget(const SizedBox());
    camera.holdInit!.complete();
    await tester.pump();
    await tester.pump();
    expect(camera.disposed, 1);
  });

  testWidgets('a los 30 s se detiene sola y devuelve el video', (tester) async {
    final results = await _open(tester);
    final gesture = await _hold(tester);
    await tester.runAsync(
      () =>
          Future<void>.delayed(const Duration(seconds: 30, milliseconds: 200)),
    );
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pumpAndSettle();
    expect(results.single!.isVideo, isTrue);
    expect(results.single!.duration! >= const Duration(seconds: 30), isTrue);
    await gesture.up();
    await tester.pump();
  }, timeout: const Timeout(Duration(seconds: 90)));
}
