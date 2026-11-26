import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/database/models/abuse_event_model.dart';

void main() {
  group('AbuseEventModel', () {
    test('fromMap parsea correctamente un evento completo', () {
      final map = {
        'id': 'abuse-123',
        'id_usuario': 'user-456',
        'tipo_abuso': 'excessive_cancellations',
        'conteo': 5,
        'detectado_en': '2026-11-26T10:00:00Z',
        'accion_tomada': 'shadow_ban',
        'accion_tomada_en': '2026-11-26T11:00:00Z',
        'resuelto': 1,
      };

      final event = AbuseEventModel.fromMap(map);

      expect(event.id, 'abuse-123');
      expect(event.userId, 'user-456');
      expect(event.abuseType, 'excessive_cancellations');
      expect(event.count, 5);
      expect(event.detectedAt, DateTime.parse('2026-11-26T10:00:00Z'));
      expect(event.actionTaken, 'shadow_ban');
      expect(event.actionTakenAt, DateTime.parse('2026-11-26T11:00:00Z'));
      expect(event.isResolved, true);
    });

    test('fromMap acepta evento sin acción tomada', () {
      final map = {
        'id': 'abuse-123',
        'id_usuario': 'user-456',
        'tipo_abuso': 'excessive_rejections',
        'conteo': 3,
        'detectado_en': '2026-11-26T10:00:00Z',
        'resuelto': 0,
      };

      final event = AbuseEventModel.fromMap(map);

      expect(event.actionTaken, null);
      expect(event.actionTakenAt, null);
      expect(event.isResolved, false);
    });

    test('fromMap interpreta resuelto null como false', () {
      final map = {
        'id': 'abuse-123',
        'id_usuario': 'user-456',
        'tipo_abuso': 'excessive_jobs',
        'conteo': 10,
        'detectado_en': '2026-11-26T10:00:00Z',
      };

      final event = AbuseEventModel.fromMap(map);

      expect(event.isResolved, false);
    });

    test('fromMap interpreta resuelto 1 como true', () {
      final map = {
        'id': 'abuse-123',
        'id_usuario': 'user-456',
        'tipo_abuso': 'excessive_jobs',
        'conteo': 10,
        'detectado_en': '2026-11-26T10:00:00Z',
        'resuelto': 1,
      };

      final event = AbuseEventModel.fromMap(map);

      expect(event.isResolved, true);
    });

    test('toMap serializa correctamente todos los campos', () {
      final detectedAt = DateTime.parse('2026-11-26T10:00:00Z');
      final actionTakenAt = DateTime.parse('2026-11-26T11:00:00Z');
      
      final event = AbuseEventModel(
        id: 'abuse-123',
        userId: 'user-456',
        abuseType: 'excessive_cancellations',
        count: 7,
        detectedAt: detectedAt,
        actionTaken: 'trust_penalty',
        actionTakenAt: actionTakenAt,
        isResolved: true,
      );

      final map = event.toMap();

      expect(map['id'], 'abuse-123');
      expect(map['id_usuario'], 'user-456');
      expect(map['tipo_abuso'], 'excessive_cancellations');
      expect(map['conteo'], 7);
      expect(map['detectado_en'], detectedAt.toIso8601String());
      expect(map['accion_tomada'], 'trust_penalty');
      expect(map['accion_tomada_en'], actionTakenAt.toIso8601String());
      expect(map['resuelto'], 1);
    });

    test('toMap serializa isResolved false como 0', () {
      final detectedAt = DateTime.parse('2026-11-26T10:00:00Z');
      
      final event = AbuseEventModel(
        id: 'abuse-123',
        userId: 'user-456',
        abuseType: 'excessive_jobs',
        count: 8,
        detectedAt: detectedAt,
        isResolved: false,
      );

      final map = event.toMap();

      expect(map['resuelto'], 0);
    });

    test('toMap serializa actionTakenAt null correctamente', () {
      final detectedAt = DateTime.parse('2026-11-26T10:00:00Z');
      
      final event = AbuseEventModel(
        id: 'abuse-123',
        userId: 'user-456',
        abuseType: 'excessive_rejections',
        count: 4,
        detectedAt: detectedAt,
      );

      final map = event.toMap();

      expect(map['accion_tomada'], null);
      expect(map['accion_tomada_en'], null);
    });

    test('constructor usa isResolved false por defecto', () {
      final event = AbuseEventModel(
        id: 'abuse-123',
        userId: 'user-456',
        abuseType: 'excessive_jobs',
        count: 12,
        detectedAt: DateTime.now(),
      );

      expect(event.isResolved, false);
    });

    test('copyWith modifica solo los campos especificados', () {
      final original = AbuseEventModel(
        id: 'abuse-123',
        userId: 'user-456',
        abuseType: 'excessive_cancellations',
        count: 5,
        detectedAt: DateTime.parse('2026-11-26T10:00:00Z'),
        isResolved: false,
      );

      final modified = original.copyWith(
        actionTaken: 'temporary_ban',
        actionTakenAt: DateTime.parse('2026-11-26T12:00:00Z'),
        isResolved: true,
      );

      expect(modified.id, 'abuse-123');
      expect(modified.userId, 'user-456');
      expect(modified.abuseType, 'excessive_cancellations');
      expect(modified.count, 5);
      expect(modified.actionTaken, 'temporary_ban');
      expect(modified.isResolved, true);
    });

    test('copyWith sin parámetros devuelve copia idéntica', () {
      final original = AbuseEventModel(
        id: 'abuse-123',
        userId: 'user-456',
        abuseType: 'excessive_jobs',
        count: 15,
        detectedAt: DateTime.parse('2026-11-26T10:00:00Z'),
      );

      final copy = original.copyWith();

      expect(copy.id, original.id);
      expect(copy.userId, original.userId);
      expect(copy.abuseType, original.abuseType);
      expect(copy.count, original.count);
      expect(copy.detectedAt, original.detectedAt);
      expect(copy.isResolved, original.isResolved);
    });

    test('tipos de abuso válidos', () {
      final now = DateTime.now();
      
      final types = [
        'excessive_jobs',
        'excessive_rejections',
        'excessive_cancellations',
      ];

      for (final type in types) {
        final event = AbuseEventModel(
          id: 'abuse-$type',
          userId: 'user-1',
          abuseType: type,
          count: 5,
          detectedAt: now,
        );

        expect(event.abuseType, type);
      }
    });

    test('tipos de acción válidos', () {
      final now = DateTime.now();
      
      final actions = [
        'shadow_ban',
        'trust_penalty',
        'temporary_ban',
      ];

      for (final action in actions) {
        final event = AbuseEventModel(
          id: 'abuse-$action',
          userId: 'user-1',
          abuseType: 'excessive_jobs',
          count: 5,
          detectedAt: now,
          actionTaken: action,
        );

        expect(event.actionTaken, action);
      }
    });

    test('conteo de abuso refleja la cantidad de eventos', () {
      final event = AbuseEventModel(
        id: 'abuse-123',
        userId: 'user-456',
        abuseType: 'excessive_rejections',
        count: 20,
        detectedAt: DateTime.now(),
      );

      expect(event.count, 20);
    });
  });
}
