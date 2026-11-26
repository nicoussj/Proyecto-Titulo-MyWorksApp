import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/database/models/report_model.dart';

void main() {
  group('ReportModel', () {
    test('fromMap parsea correctamente un reporte completo', () {
      final map = {
        'id': 'report-123',
        'id_reportante': 'user-456',
        'id_usuario_reportado': 'user-789',
        'motivo': 'acoso',
        'descripcion': 'Comportamiento inapropiado en el chat',
        'estado': 'revisado',
        'creado_en': '2026-11-26T10:00:00Z',
      };

      final report = ReportModel.fromMap(map);

      expect(report.id, 'report-123');
      expect(report.reporterId, 'user-456');
      expect(report.reportedUserId, 'user-789');
      expect(report.reason, 'acoso');
      expect(report.description, 'Comportamiento inapropiado en el chat');
      expect(report.status, 'revisado');
      expect(report.createdAt, DateTime.parse('2026-11-26T10:00:00Z'));
    });

    test('fromMap acepta reporte sin descripción', () {
      final map = {
        'id': 'report-123',
        'id_reportante': 'user-456',
        'id_usuario_reportado': 'user-789',
        'motivo': 'spam',
        'estado': 'pendiente',
        'creado_en': '2026-11-26T10:00:00Z',
      };

      final report = ReportModel.fromMap(map);

      expect(report.description, null);
    });

    test('fromMap usa estado pendiente por defecto si falta', () {
      final map = {
        'id': 'report-123',
        'id_reportante': 'user-456',
        'id_usuario_reportado': 'user-789',
        'motivo': 'fraude',
        'creado_en': '2026-11-26T10:00:00Z',
      };

      final report = ReportModel.fromMap(map);

      expect(report.status, 'pendiente');
    });

    test('toMap serializa correctamente todos los campos', () {
      final createdAt = DateTime.parse('2026-11-26T10:00:00Z');
      
      final report = ReportModel(
        id: 'report-123',
        reporterId: 'user-456',
        reportedUserId: 'user-789',
        reason: 'incumplimiento',
        description: 'No completó el trabajo acordado',
        status: 'resuelto',
        createdAt: createdAt,
      );

      final map = report.toMap();

      expect(map['id'], 'report-123');
      expect(map['id_reportante'], 'user-456');
      expect(map['id_usuario_reportado'], 'user-789');
      expect(map['motivo'], 'incumplimiento');
      expect(map['descripcion'], 'No completó el trabajo acordado');
      expect(map['estado'], 'resuelto');
      expect(map['creado_en'], createdAt.toIso8601String());
    });

    test('toMap serializa descripción null', () {
      final createdAt = DateTime.parse('2026-11-26T10:00:00Z');
      
      final report = ReportModel(
        id: 'report-123',
        reporterId: 'user-456',
        reportedUserId: 'user-789',
        reason: 'otros',
        createdAt: createdAt,
      );

      final map = report.toMap();

      expect(map['descripcion'], null);
    });

    test('constructor usa estado pendiente por defecto', () {
      final report = ReportModel(
        id: 'report-123',
        reporterId: 'user-456',
        reportedUserId: 'user-789',
        reason: 'spam',
        createdAt: DateTime.now(),
      );

      expect(report.status, 'pendiente');
    });

    test('estados válidos de reporte', () {
      final now = DateTime.now();
      
      final estados = [
        'pendiente',
        'revisado',
        'resuelto',
        'descartado',
      ];

      for (final estado in estados) {
        final report = ReportModel(
          id: 'report-$estado',
          reporterId: 'user-1',
          reportedUserId: 'user-2',
          reason: 'test',
          status: estado,
          createdAt: now,
        );

        expect(report.status, estado);
      }
    });

    test('motivos comunes de reporte', () {
      final now = DateTime.now();
      
      final motivos = [
        'acoso',
        'spam',
        'fraude',
        'incumplimiento',
        'lenguaje_ofensivo',
        'otros',
      ];

      for (final motivo in motivos) {
        final report = ReportModel(
          id: 'report-$motivo',
          reporterId: 'user-1',
          reportedUserId: 'user-2',
          reason: motivo,
          createdAt: now,
        );

        expect(report.reason, motivo);
      }
    });

    test('reporte con descripción detallada', () {
      final report = ReportModel(
        id: 'report-123',
        reporterId: 'user-456',
        reportedUserId: 'user-789',
        reason: 'acoso',
        description: 'El usuario envió mensajes inapropiados repetidamente '
            'después de que le pedí que dejara de hacerlo. '
            'Adjunto capturas de pantalla.',
        status: 'pendiente',
        createdAt: DateTime.now(),
      );

      expect(report.description, isNotNull);
      expect(report.description!.length, greaterThan(50));
    });

    test('idempotencia de serialización', () {
      final original = ReportModel(
        id: 'report-123',
        reporterId: 'user-456',
        reportedUserId: 'user-789',
        reason: 'fraude',
        description: 'Intentó cobrar dinero adicional',
        status: 'revisado',
        createdAt: DateTime.parse('2026-11-26T10:00:00Z'),
      );

      final map = original.toMap();
      final reconstructed = ReportModel.fromMap(map);

      expect(reconstructed.id, original.id);
      expect(reconstructed.reporterId, original.reporterId);
      expect(reconstructed.reportedUserId, original.reportedUserId);
      expect(reconstructed.reason, original.reason);
      expect(reconstructed.description, original.description);
      expect(reconstructed.status, original.status);
      expect(reconstructed.createdAt, original.createdAt);
    });
  });
}
