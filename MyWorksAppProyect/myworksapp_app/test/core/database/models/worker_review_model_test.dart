import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/database/models/worker_review_model.dart';

void main() {
  group('WorkerReviewModel', () {
    test('displayReviewerName cuando no hay nombre devuelve "Cliente verificado"', () {
      final review = WorkerReviewModel(
        id: '1',
        score: 5,
        createdAt: DateTime(2026, 11, 26),
        reviewerName: null,
      );

      expect(review.displayReviewerName, 'Cliente verificado');
    });

    test('displayReviewerName cuando el nombre está vacío devuelve "Cliente verificado"', () {
      final review = WorkerReviewModel(
        id: '1',
        score: 5,
        createdAt: DateTime(2026, 11, 26),
        reviewerName: '   ',
      );

      expect(review.displayReviewerName, 'Cliente verificado');
    });

    test('displayReviewerName con nombre simple lo devuelve completo', () {
      final review = WorkerReviewModel(
        id: '1',
        score: 5,
        createdAt: DateTime(2026, 11, 26),
        reviewerName: 'Carlos',
      );

      expect(review.displayReviewerName, 'Carlos');
    });

    test('displayReviewerName con nombre completo muestra inicial del apellido', () {
      final review = WorkerReviewModel(
        id: '1',
        score: 5,
        createdAt: DateTime(2026, 11, 26),
        reviewerName: 'Carlos González',
      );

      expect(review.displayReviewerName, 'Carlos G.');
    });

    test('displayReviewerName con múltiples espacios normaliza correctamente', () {
      final review = WorkerReviewModel(
        id: '1',
        score: 5,
        createdAt: DateTime(2026, 11, 26),
        reviewerName: 'María   Elena   Pérez',
      );

      expect(review.displayReviewerName, 'María P.');
    });

    test('displayReviewerName con apellido vacío solo muestra primer nombre', () {
      final review = WorkerReviewModel(
        id: '1',
        score: 5,
        createdAt: DateTime(2026, 11, 26),
        reviewerName: 'Pedro ',
      );

      expect(review.displayReviewerName, 'Pedro');
    });

    test('hasComment es false cuando comment es null', () {
      final review = WorkerReviewModel(
        id: '1',
        score: 5,
        createdAt: DateTime(2026, 11, 26),
        comment: null,
      );

      expect(review.hasComment, false);
    });

    test('hasComment es false cuando comment está vacío', () {
      final review = WorkerReviewModel(
        id: '1',
        score: 5,
        createdAt: DateTime(2026, 11, 26),
        comment: '   ',
      );

      expect(review.hasComment, false);
    });

    test('hasComment es true cuando hay comentario válido', () {
      final review = WorkerReviewModel(
        id: '1',
        score: 5,
        createdAt: DateTime(2026, 11, 26),
        comment: 'Excelente trabajo',
      );

      expect(review.hasComment, true);
    });

    test('propiedades se asignan correctamente en el constructor', () {
      final now = DateTime(2026, 11, 26, 10, 30);
      final review = WorkerReviewModel(
        id: 'review-123',
        score: 4,
        createdAt: now,
        comment: 'Muy profesional',
        reviewerName: 'Ana Torres',
      );

      expect(review.id, 'review-123');
      expect(review.score, 4);
      expect(review.createdAt, now);
      expect(review.comment, 'Muy profesional');
      expect(review.reviewerName, 'Ana Torres');
    });
  });
}
