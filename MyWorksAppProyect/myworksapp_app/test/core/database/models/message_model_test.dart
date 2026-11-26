import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/database/models/message_model.dart';

void main() {
  group('MessageModel', () {
    test('fromMap parsea correctamente un mensaje de texto completo', () {
      final map = {
        'id': 'msg-123',
        'id_trabajo': 'job-456',
        'id_remitente': 'user-789',
        'id_destinatario': 'user-012',
        'contenido': 'Hola, ¿cuándo podemos coordinar el servicio?',
        'tipo': 'texto',
        'leido': 1,
        'creado_en': '2026-11-26T10:00:00Z',
      };

      final message = MessageModel.fromMap(map);

      expect(message.id, 'msg-123');
      expect(message.jobId, 'job-456');
      expect(message.senderId, 'user-789');
      expect(message.receiverId, 'user-012');
      expect(message.content, 'Hola, ¿cuándo podemos coordinar el servicio?');
      expect(message.type, 'texto');
      expect(message.imagePath, null);
      expect(message.isRead, true);
      expect(message.createdAt, DateTime.parse('2026-11-26T10:00:00Z'));
    });

    test('fromMap parsea mensaje con imagen', () {
      final map = {
        'id': 'msg-123',
        'id_trabajo': 'job-456',
        'id_remitente': 'user-789',
        'id_destinatario': 'user-012',
        'contenido': 'Adjunto foto del problema',
        'tipo': 'imagen',
        'ruta_imagen': 'uploads/images/problema-123.jpg',
        'leido': 0,
        'creado_en': '2026-11-26T10:00:00Z',
      };

      final message = MessageModel.fromMap(map);

      expect(message.type, 'imagen');
      expect(message.imagePath, 'uploads/images/problema-123.jpg');
      expect(message.isRead, false);
    });

    test('fromMap usa "texto" como tipo por defecto si falta', () {
      final map = {
        'id': 'msg-123',
        'id_trabajo': 'job-456',
        'id_remitente': 'user-789',
        'id_destinatario': 'user-012',
        'contenido': 'Mensaje sin tipo',
        'creado_en': '2026-11-26T10:00:00Z',
      };

      final message = MessageModel.fromMap(map);

      expect(message.type, 'texto');
    });

    test('fromMap interpreta leido 0 como false', () {
      final map = {
        'id': 'msg-123',
        'id_trabajo': 'job-456',
        'id_remitente': 'user-789',
        'id_destinatario': 'user-012',
        'contenido': 'No leído',
        'leido': 0,
        'creado_en': '2026-11-26T10:00:00Z',
      };

      final message = MessageModel.fromMap(map);

      expect(message.isRead, false);
    });

    test('fromMap interpreta leido 1 como true', () {
      final map = {
        'id': 'msg-123',
        'id_trabajo': 'job-456',
        'id_remitente': 'user-789',
        'id_destinatario': 'user-012',
        'contenido': 'Leído',
        'leido': 1,
        'creado_en': '2026-11-26T10:00:00Z',
      };

      final message = MessageModel.fromMap(map);

      expect(message.isRead, true);
    });

    test('fromMap interpreta leido null como false', () {
      final map = {
        'id': 'msg-123',
        'id_trabajo': 'job-456',
        'id_remitente': 'user-789',
        'id_destinatario': 'user-012',
        'contenido': 'Sin estado leído',
        'creado_en': '2026-11-26T10:00:00Z',
      };

      final message = MessageModel.fromMap(map);

      expect(message.isRead, false);
    });

    test('fromMap acepta imagePath null', () {
      final map = {
        'id': 'msg-123',
        'id_trabajo': 'job-456',
        'id_remitente': 'user-789',
        'id_destinatario': 'user-012',
        'contenido': 'Texto simple',
        'tipo': 'texto',
        'creado_en': '2026-11-26T10:00:00Z',
      };

      final message = MessageModel.fromMap(map);

      expect(message.imagePath, null);
    });

    test('toMap serializa correctamente todos los campos', () {
      final createdAt = DateTime.parse('2026-11-26T10:00:00Z');
      
      final message = MessageModel(
        id: 'msg-123',
        jobId: 'job-456',
        senderId: 'user-789',
        receiverId: 'user-012',
        content: 'Mensaje de prueba',
        type: 'texto',
        imagePath: null,
        isRead: true,
        createdAt: createdAt,
      );

      final map = message.toMap();

      expect(map['id'], 'msg-123');
      expect(map['id_trabajo'], 'job-456');
      expect(map['id_remitente'], 'user-789');
      expect(map['id_destinatario'], 'user-012');
      expect(map['contenido'], 'Mensaje de prueba');
      expect(map['tipo'], 'texto');
      expect(map['ruta_imagen'], null);
      expect(map['leido'], 1);
      expect(map['creado_en'], createdAt.toUtc().toIso8601String());
    });

    test('toMap serializa isRead false como 0', () {
      final message = MessageModel(
        id: 'msg-123',
        jobId: 'job-456',
        senderId: 'user-789',
        receiverId: 'user-012',
        content: 'No leído',
        isRead: false,
        createdAt: DateTime.now(),
      );

      final map = message.toMap();

      expect(map['leido'], 0);
    });

    test('toMap serializa mensaje con imagen', () {
      final message = MessageModel(
        id: 'msg-123',
        jobId: 'job-456',
        senderId: 'user-789',
        receiverId: 'user-012',
        content: 'Foto adjunta',
        type: 'imagen',
        imagePath: 'uploads/images/foto-123.jpg',
        isRead: false,
        createdAt: DateTime.now(),
      );

      final map = message.toMap();

      expect(map['tipo'], 'imagen');
      expect(map['ruta_imagen'], 'uploads/images/foto-123.jpg');
    });

    test('constructor usa valores por defecto correctos', () {
      final message = MessageModel(
        id: 'msg-123',
        jobId: 'job-456',
        senderId: 'user-789',
        receiverId: 'user-012',
        content: 'Mensaje simple',
        createdAt: DateTime.now(),
      );

      expect(message.type, 'texto');
      expect(message.imagePath, null);
      expect(message.isRead, false);
    });

    test('toMap convierte createdAt a UTC', () {
      final localTime = DateTime(2026, 11, 26, 10, 0, 0);
      
      final message = MessageModel(
        id: 'msg-123',
        jobId: 'job-456',
        senderId: 'user-789',
        receiverId: 'user-012',
        content: 'Test',
        createdAt: localTime,
      );

      final map = message.toMap();

      expect(map['creado_en'], localTime.toUtc().toIso8601String());
    });

    test('idempotencia de serialización', () {
      final original = MessageModel(
        id: 'msg-123',
        jobId: 'job-456',
        senderId: 'user-789',
        receiverId: 'user-012',
        content: 'Hola, ¿cómo estás?',
        type: 'texto',
        imagePath: null,
        isRead: true,
        createdAt: DateTime.parse('2026-11-26T10:00:00Z'),
      );

      final map = original.toMap();
      final reconstructed = MessageModel.fromMap(map);

      expect(reconstructed.id, original.id);
      expect(reconstructed.jobId, original.jobId);
      expect(reconstructed.senderId, original.senderId);
      expect(reconstructed.receiverId, original.receiverId);
      expect(reconstructed.content, original.content);
      expect(reconstructed.type, original.type);
      expect(reconstructed.imagePath, original.imagePath);
      expect(reconstructed.isRead, original.isRead);
      expect(reconstructed.createdAt.toUtc(), original.createdAt.toUtc());
    });

    test('tipos de mensaje válidos', () {
      final tipos = ['texto', 'imagen'];

      for (final tipo in tipos) {
        final message = MessageModel(
          id: 'msg-$tipo',
          jobId: 'job-1',
          senderId: 'user-1',
          receiverId: 'user-2',
          content: 'Test',
          type: tipo,
          createdAt: DateTime.now(),
        );

        expect(message.type, tipo);
      }
    });
  });
}
