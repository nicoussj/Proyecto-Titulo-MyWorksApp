import 'dart:math' as math;

import '../database/models/worker_model.dart';

/// Orden de marketplace: usa el score del servidor si existe.
/// Si no, cae a nota pública menos penalización por rechazos.
class WorkerReputationService {
  WorkerReputationService._();
  static final WorkerReputationService instance = WorkerReputationService._();

  static const double _penaltyPerRejection = 0.35;
  static const double _maxPenalty = 1.75;

  /// Puntaje interno para ordenar listados (mayor = más arriba).
  /// Misma regla que Postgres: `score_listado` ya incluye `prioridad_manual × 2`.
  double listingScore(WorkerModel worker) {
    final stored = worker.listingScore;
    if (stored != null) return stored;
    final penalty = math.min(
      worker.rejectionCount * _penaltyPerRejection,
      _maxPenalty,
    );
    return worker.rating - penalty + worker.manualPriority * 2.0;
  }

  void sortForListing(List<WorkerModel> workers) {
    workers.sort((a, b) {
      final byScore = listingScore(b).compareTo(listingScore(a));
      if (byScore != 0) return byScore;
      return a.userId.compareTo(b.userId);
    });
  }
}
