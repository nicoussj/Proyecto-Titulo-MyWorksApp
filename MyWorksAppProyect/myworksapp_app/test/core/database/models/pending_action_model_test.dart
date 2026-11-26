import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/database/models/pending_action_model.dart';

void main() {
  group('PendingActionModel', () {
    test('fromMap parsea correctamente una acción pendiente completa', () {
      final map = {
        'id': 'action-123',
        'id_usuario': 'user-456',
        'tipo_accion': 'create_job',
        'tipo_entidad': 'trabajo',
        'id_entidad': 'job-789',
        'datos': '{"titulo":"Plomería","descripcion":"Reparación"}',
        'estado': 'pendiente_sync',
        'conteo_reintentos': 0,
        'mensaje_error': null,
        'creado_en': '2026-11-26T10:00:00Z',
        'actualizado_en': '2026-11-26T10:00:00Z',
      };

      final action = PendingActionModel.fromMap(map);

      expect(action.id, 'action-123');
      expect(action.userId, 'user-456');
      expect(action.actionType, 'create_job');
      expect(action.entityType, 'trabajo');
      expect(action.entityId, 'job-789');
      expect(action.data, '{"titulo":"Plomería","descripcion":"Reparación"}');
      expect(action.status, 'pendiente_sync');
      expect(action.retryCount, 0);
      expect(action.errorMessage, null);
      expect(action.createdAt, DateTime.parse('2026-11-26T10:00:00Z'));
      expect(action.updatedAt, DateTime.parse('2026-11-26T10:00:00Z'));
    });

    test('fromMap acepta entityId null', () {
      final map = {
        'id': 'action-123',
        'id_usuario': 'user-456',
        'tipo_accion': 'update_profile',
        'tipo_entidad': 'perfil',
        'datos': '{"nombre":"Juan"}',
        'estado': 'sincronizando',
        'conteo_reintentos': 1,
        'creado_en': '2026-11-26T10:00:00Z',
        'actualizado_en': '2026-11-26T10:00:00Z',
      };

      final action = PendingActionModel.fromMap(map);

      expect(action.entityId, null);
    });

    test('fromMap acepta mensaje de error', () {
      final map = {
        'id': 'action-123',
        'id_usuario': 'user-456',
        'tipo_accion': 'send_message',
        'tipo_entidad': 'mensaje',
        'datos': '{"texto":"Hola"}',
        'estado': 'fallido',
        'conteo_reintentos': 3,
        'mensaje_error': 'Sin conexión a internet',
        'creado_en': '2026-11-26T10:00:00Z',
        'actualizado_en': '2026-11-26T10:30:00Z',
      };

      final action = PendingActionModel.fromMap(map);

      expect(action.status, 'fallido');
      expect(action.errorMessage, 'Sin conexión a internet');
      expect(action.retryCount, 3);
    });

    test('toMap serializa correctamente todos los campos', () {
      final createdAt = DateTime.parse('2026-11-26T10:00:00Z');
      final updatedAt = DateTime.parse('2026-11-26T10:30:00Z');
      
      final action = PendingActionModel(
        id: 'action-123',
        userId: 'user-456',
        actionType: 'create_job',
        entityType: 'trabajo',
        entityId: 'job-789',
        data: '{"titulo":"Electricidad"}',
        status: 'sincronizado',
        retryCount: 0,
        errorMessage: null,
        createdAt: createdAt,
        updatedAt: updatedAt,
      );

      final map = action.toMap();

      expect(map['id'], 'action-123');
      expect(map['id_usuario'], 'user-456');
      expect(map['tipo_accion'], 'create_job');
      expect(map['tipo_entidad'], 'trabajo');
      expect(map['id_entidad'], 'job-789');
      expect(map['datos'], '{"titulo":"Electricidad"}');
      expect(map['estado'], 'sincronizado');
      expect(map['conteo_reintentos'], 0);
      expect(map['mensaje_error'], null);
      expect(map['creado_en'], createdAt.toIso8601String());
      expect(map['actualizado_en'], updatedAt.toIso8601String());
    });

    test('constructor usa valores por defecto correctos', () {
      final now = DateTime.parse('2026-11-26T10:00:00Z');
      
      final action = PendingActionModel(
        id: 'action-123',
        userId: 'user-456',
        actionType: 'update_job',
        entityType: 'trabajo',
        data: '{}',
        createdAt: now,
        updatedAt: now,
      );

      expect(action.status, 'pendiente_sync');
      expect(action.retryCount, 0);
      expect(action.errorMessage, null);
      expect(action.entityId, null);
    });

    test('copyWith modifica solo los campos especificados', () {
      final original = PendingActionModel(
        id: 'action-123',
        userId: 'user-456',
        actionType: 'create_job',
        entityType: 'trabajo',
        data: '{"titulo":"Test"}',
        status: 'pendiente_sync',
        retryCount: 0,
        createdAt: DateTime.parse('2026-11-26T10:00:00Z'),
        updatedAt: DateTime.parse('2026-11-26T10:00:00Z'),
      );

      final modified = original.copyWith(
        status: 'sincronizando',
        retryCount: 1,
      );

      expect(modified.id, 'action-123');
      expect(modified.userId, 'user-456');
      expect(modified.actionType, 'create_job');
      expect(modified.status, 'sincronizando');
      expect(modified.retryCount, 1);
    });

    test('isPending devuelve true para estado pendiente_sync', () {
      final action = PendingActionModel(
        id: 'action-123',
        userId: 'user-456',
        actionType: 'create_job',
        entityType: 'trabajo',
        data: '{}',
        status: 'pendiente_sync',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      expect(action.isPending, true);
    });

    test('isSyncing devuelve true para estado sincronizando', () {
      final action = PendingActionModel(
        id: 'action-123',
        userId: 'user-456',
        actionType: 'create_job',
        entityType: 'trabajo',
        data: '{}',
        status: 'sincronizando',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      expect(action.isSyncing, true);
    });

    test('isSynced devuelve true para estado sincronizado', () {
      final action = PendingActionModel(
        id: 'action-123',
        userId: 'user-456',
        actionType: 'create_job',
        entityType: 'trabajo',
        data: '{}',
        status: 'sincronizado',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      expect(action.isSynced, true);
    });

    test('hasFailed devuelve true para estado fallido', () {
      final action = PendingActionModel(
        id: 'action-123',
        userId: 'user-456',
        actionType: 'create_job',
        entityType: 'trabajo',
        data: '{}',
        status: 'fallido',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      expect(action.hasFailed, true);
    });

    test('estados mutuamente exclusivos', () {
      final now = DateTime.now();
      
      final pending = PendingActionModel(
        id: '1',
        userId: 'u1',
        actionType: 'a',
        entityType: 'e',
        data: '{}',
        status: 'pendiente_sync',
        createdAt: now,
        updatedAt: now,
      );

      expect(pending.isPending, true);
      expect(pending.isSyncing, false);
      expect(pending.isSynced, false);
      expect(pending.hasFailed, false);
    });

    test('tipos de acción válidos', () {
      final now = DateTime.now();
      
      final types = [
        'create_job',
        'update_job',
        'send_message',
        'update_profile',
      ];

      for (final type in types) {
        final action = PendingActionModel(
          id: 'action-$type',
          userId: 'user-1',
          actionType: type,
          entityType: 'test',
          data: '{}',
          createdAt: now,
          updatedAt: now,
        );

        expect(action.actionType, type);
      }
    });
  });
}
