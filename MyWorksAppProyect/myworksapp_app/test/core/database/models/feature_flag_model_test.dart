import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/database/models/feature_flag_model.dart';

void main() {
  group('FeatureFlagModel', () {
    test('fromMap parsea correctamente un feature flag completo', () {
      final map = {
        'id': 'flag-123',
        'nombre_bandera': 'nueva_interfaz_pagos',
        'habilitada': 1,
        'version_app': '2.0.0',
        'rol': 'especialista',
        'id_usuario': 'user-456',
        'creado_en': '2026-11-26T10:00:00Z',
        'actualizado_en': '2026-11-26T12:00:00Z',
      };

      final flag = FeatureFlagModel.fromMap(map);

      expect(flag.id, 'flag-123');
      expect(flag.flagName, 'nueva_interfaz_pagos');
      expect(flag.isEnabled, true);
      expect(flag.appVersion, '2.0.0');
      expect(flag.role, 'especialista');
      expect(flag.userId, 'user-456');
      expect(flag.createdAt, DateTime.parse('2026-11-26T10:00:00Z'));
      expect(flag.updatedAt, DateTime.parse('2026-11-26T12:00:00Z'));
    });

    test('fromMap interpreta habilitada=0 como false', () {
      final map = {
        'id': 'flag-123',
        'nombre_bandera': 'feature_beta',
        'habilitada': 0,
        'creado_en': '2026-11-26T10:00:00Z',
        'actualizado_en': '2026-11-26T10:00:00Z',
      };

      final flag = FeatureFlagModel.fromMap(map);

      expect(flag.isEnabled, false);
    });

    test('fromMap interpreta habilitada null como false', () {
      final map = {
        'id': 'flag-123',
        'nombre_bandera': 'feature_beta',
        'creado_en': '2026-11-26T10:00:00Z',
        'actualizado_en': '2026-11-26T10:00:00Z',
      };

      final flag = FeatureFlagModel.fromMap(map);

      expect(flag.isEnabled, false);
    });

    test('fromMap acepta campos opcionales como null', () {
      final map = {
        'id': 'flag-123',
        'nombre_bandera': 'feature_global',
        'habilitada': 1,
        'creado_en': '2026-11-26T10:00:00Z',
        'actualizado_en': '2026-11-26T10:00:00Z',
      };

      final flag = FeatureFlagModel.fromMap(map);

      expect(flag.appVersion, null);
      expect(flag.role, null);
      expect(flag.userId, null);
    });

    test('toMap serializa correctamente todos los campos', () {
      final createdAt = DateTime.parse('2026-11-26T10:00:00Z');
      final updatedAt = DateTime.parse('2026-11-26T12:00:00Z');
      
      final flag = FeatureFlagModel(
        id: 'flag-123',
        flagName: 'modo_oscuro',
        isEnabled: true,
        appVersion: '1.5.0',
        role: 'admin',
        userId: 'user-789',
        createdAt: createdAt,
        updatedAt: updatedAt,
      );

      final map = flag.toMap();

      expect(map['id'], 'flag-123');
      expect(map['nombre_bandera'], 'modo_oscuro');
      expect(map['habilitada'], 1);
      expect(map['version_app'], '1.5.0');
      expect(map['rol'], 'admin');
      expect(map['id_usuario'], 'user-789');
      expect(map['creado_en'], createdAt.toIso8601String());
      expect(map['actualizado_en'], updatedAt.toIso8601String());
    });

    test('toMap serializa isEnabled false como 0', () {
      final now = DateTime.parse('2026-11-26T10:00:00Z');
      
      final flag = FeatureFlagModel(
        id: 'flag-123',
        flagName: 'feature_disabled',
        isEnabled: false,
        createdAt: now,
        updatedAt: now,
      );

      final map = flag.toMap();

      expect(map['habilitada'], 0);
    });

    test('copyWith modifica solo los campos especificados', () {
      final original = FeatureFlagModel(
        id: 'flag-123',
        flagName: 'feature_original',
        isEnabled: false,
        appVersion: '1.0.0',
        role: 'cliente',
        createdAt: DateTime.parse('2026-11-26T10:00:00Z'),
        updatedAt: DateTime.parse('2026-11-26T10:00:00Z'),
      );

      final modified = original.copyWith(
        isEnabled: true,
        appVersion: '2.0.0',
      );

      expect(modified.id, 'flag-123');
      expect(modified.flagName, 'feature_original');
      expect(modified.isEnabled, true);
      expect(modified.appVersion, '2.0.0');
      expect(modified.role, 'cliente');
      expect(modified.createdAt, original.createdAt);
    });

    test('copyWith sin parámetros devuelve copia idéntica', () {
      final original = FeatureFlagModel(
        id: 'flag-123',
        flagName: 'feature_test',
        isEnabled: true,
        createdAt: DateTime.parse('2026-11-26T10:00:00Z'),
        updatedAt: DateTime.parse('2026-11-26T10:00:00Z'),
      );

      final copy = original.copyWith();

      expect(copy.id, original.id);
      expect(copy.flagName, original.flagName);
      expect(copy.isEnabled, original.isEnabled);
      expect(copy.createdAt, original.createdAt);
      expect(copy.updatedAt, original.updatedAt);
    });

    test('flags globales: sin versión, rol ni usuario', () {
      final map = {
        'id': 'flag-global',
        'nombre_bandera': 'mantenimiento',
        'habilitada': 1,
        'creado_en': '2026-11-26T10:00:00Z',
        'actualizado_en': '2026-11-26T10:00:00Z',
      };

      final flag = FeatureFlagModel.fromMap(map);

      expect(flag.appVersion, null);
      expect(flag.role, null);
      expect(flag.userId, null);
      expect(flag.isEnabled, true);
    });

    test('flags específicos por usuario', () {
      final map = {
        'id': 'flag-user',
        'nombre_bandera': 'beta_tester',
        'habilitada': 1,
        'id_usuario': 'user-special',
        'creado_en': '2026-11-26T10:00:00Z',
        'actualizado_en': '2026-11-26T10:00:00Z',
      };

      final flag = FeatureFlagModel.fromMap(map);

      expect(flag.userId, 'user-special');
      expect(flag.isEnabled, true);
    });
  });
}
