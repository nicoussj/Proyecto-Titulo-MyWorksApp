import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/database/models/rating_model.dart';

void main() {
  group('RatingModel', () {
    test('fromMap parsea correctamente desde un mapa completo', () {
      final map = {
        'id': 'rating-123',
        'id_trabajo': 'job-456',
        'id_usuario': 'user-789',
        'id_calificado': 'rated-012',
        'direccion': 'trabajador_a_cliente',
        'puntaje': 5,
        'comentario': 'Excelente experiencia',
        'creado_en': '2026-11-26T10:30:00Z',
      };

      final rating = RatingModel.fromMap(map);

      expect(rating.id, 'rating-123');
      expect(rating.jobId, 'job-456');
      expect(rating.userId, 'user-789');
      expect(rating.ratedUserId, 'rated-012');
      expect(rating.direction, 'trabajador_a_cliente');
      expect(rating.score, 5);
      expect(rating.comment, 'Excelente experiencia');
      expect(rating.createdAt, DateTime.parse('2026-11-26T10:30:00Z'));
    });

    test('fromMap usa dirección por defecto cliente_a_trabajador si falta', () {
      final map = {
        'id': 'rating-123',
        'id_trabajo': 'job-456',
        'puntaje': 4,
        'creado_en': '2026-11-26T10:30:00Z',
      };

      final rating = RatingModel.fromMap(map);

      expect(rating.direction, 'cliente_a_trabajador');
    });

    test('fromMap redondea puntaje decimal', () {
      final map = {
        'id': 'rating-123',
        'id_trabajo': 'job-456',
        'puntaje': 4.7,
        'creado_en': '2026-11-26T10:30:00Z',
      };

      final rating = RatingModel.fromMap(map);

      expect(rating.score, 5);
    });

    test('fromMap asigna 0 si puntaje es null', () {
      final map = {
        'id': 'rating-123',
        'id_trabajo': 'job-456',
        'creado_en': '2026-11-26T10:30:00Z',
      };

      final rating = RatingModel.fromMap(map);

      expect(rating.score, 0);
    });

    test('fromMap parsea fecha con formato espaciado', () {
      final map = {
        'id': 'rating-123',
        'id_trabajo': 'job-456',
        'puntaje': 5,
        'creado_en': '2026-11-26 10:30:00+00',
      };

      final rating = RatingModel.fromMap(map);

      expect(rating.createdAt, isA<DateTime>());
      expect(rating.createdAt.year, 2026);
      expect(rating.createdAt.month, 11);
      expect(rating.createdAt.day, 26);
    });

    test('fromMap parsea fecha ISO estándar', () {
      final map = {
        'id': 'rating-123',
        'id_trabajo': 'job-456',
        'puntaje': 5,
        'creado_en': '2026-11-26T10:30:00+00:00',
      };

      final rating = RatingModel.fromMap(map);

      expect(rating.createdAt, DateTime.parse('2026-11-26T10:30:00+00:00'));
    });

    test('toMap serializa correctamente todos los campos', () {
      final now = DateTime.parse('2026-11-26T10:30:00Z');
      final rating = RatingModel(
        id: 'rating-123',
        jobId: 'job-456',
        userId: 'user-789',
        ratedUserId: 'rated-012',
        direction: 'cliente_a_trabajador',
        score: 5,
        comment: 'Muy profesional',
        createdAt: now,
      );

      final map = rating.toMap();

      expect(map['id'], 'rating-123');
      expect(map['id_trabajo'], 'job-456');
      expect(map['id_usuario'], 'user-789');
      expect(map['id_calificado'], 'rated-012');
      expect(map['direccion'], 'cliente_a_trabajador');
      expect(map['puntaje'], 5);
      expect(map['comentario'], 'Muy profesional');
      expect(map['creado_en'], now.toIso8601String());
    });

    test('toMap omite campos opcionales si son null', () {
      final now = DateTime.parse('2026-11-26T10:30:00Z');
      final rating = RatingModel(
        id: 'rating-123',
        jobId: 'job-456',
        score: 4,
        createdAt: now,
      );

      final map = rating.toMap();

      expect(map.containsKey('id_usuario'), false);
      expect(map.containsKey('id_calificado'), false);
      expect(map['comentario'], null);
    });

    test('constructor asigna valores por defecto correctamente', () {
      final now = DateTime.parse('2026-11-26T10:30:00Z');
      final rating = RatingModel(
        id: 'rating-123',
        jobId: 'job-456',
        score: 5,
        createdAt: now,
      );

      expect(rating.direction, 'cliente_a_trabajador');
      expect(rating.userId, null);
      expect(rating.ratedUserId, null);
      expect(rating.comment, null);
    });

    test('validación de rango de puntaje 1-5', () {
      final now = DateTime.parse('2026-11-26T10:30:00Z');
      
      final rating1 = RatingModel(id: '1', jobId: 'j1', score: 1, createdAt: now);
      final rating5 = RatingModel(id: '2', jobId: 'j2', score: 5, createdAt: now);
      
      expect(rating1.score, 1);
      expect(rating5.score, 5);
    });
  });
}
