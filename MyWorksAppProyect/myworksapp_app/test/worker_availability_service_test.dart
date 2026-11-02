import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/database/models/job_model.dart';
import 'package:myworksapp/core/services/worker_availability_service.dart';
import 'package:myworksapp/core/utils/constants.dart';

JobModel _job({
  required String status,
  required DateTime scheduled,
}) {
  final now = DateTime(2026, 11, 2, 12);
  return JobModel(
    id: 'j-${scheduled.millisecondsSinceEpoch}',
    userId: 'u1',
    workerId: 'w1',
    serviceId: 's1',
    status: status,
    address: 'Calle 1',
    description: 'test',
    scheduledDate: scheduled,
    createdAt: now,
    updatedAt: now,
  );
}

void main() {
  final day = DateTime(2026, 11, 3);

  test('marca como ocupada la hora programada de un trabajo activo', () {
    final reserved = WorkerAvailabilityService.reservedLabelsFromJobs(
      jobs: [
        _job(
          status: AppConstants.jobStatusAccepted,
          scheduled: DateTime(2026, 11, 3, 10, 0),
        ),
      ],
      day: day,
    );
    expect(reserved, contains('10:00'));
    expect(reserved, isNot(contains('11:00')));
  });

  test('ignora trabajos cancelados o de otro día', () {
    final reserved = WorkerAvailabilityService.reservedLabelsFromJobs(
      jobs: [
        _job(
          status: AppConstants.jobStatusCancelled,
          scheduled: DateTime(2026, 11, 3, 9, 0),
        ),
        _job(
          status: AppConstants.jobStatusInProgress,
          scheduled: DateTime(2026, 11, 4, 9, 0),
        ),
      ],
      day: day,
    );
    expect(reserved, isEmpty);
  });
}
