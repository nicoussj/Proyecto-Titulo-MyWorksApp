import 'package:flutter/material.dart';

import '../database/models/job_model.dart';
import '../database/repositories/job_repository.dart';
import '../utils/constants.dart';
import '../utils/mock_reserved_slots.dart';
import '../utils/worker_job_status.dart';

/// Consulta horarios ya ocupados del profesional (agenda real, no mock fijo).
class WorkerAvailabilityService {
  WorkerAvailabilityService({JobRepository? jobs})
      : _jobs = jobs ?? JobRepository();

  static final WorkerAvailabilityService instance = WorkerAvailabilityService();

  final JobRepository _jobs;

  static const Duration defaultSlotDuration = Duration(hours: 1);

  /// Estados que bloquean el mismo horario del profesional.
  static bool _blocksSchedule(String status) {
    if (WorkerJobStatus.isActive(status)) return true;
    return status == AppConstants.jobStatusPending;
  }

  /// Etiquetas `HH:mm` reservadas ese día para [workerId].
  Future<Set<String>> reservedLabelsForDay({
    required String workerId,
    required DateTime day,
  }) async {
    if (workerId.trim().isEmpty) return {};
    final jobs = await _jobs.getJobsByWorkerId(workerId);
    return reservedLabelsFromJobs(jobs: jobs, day: day);
  }

  /// Versión pura para tests: no llama a Supabase.
  static Set<String> reservedLabelsFromJobs({
    required List<JobModel> jobs,
    required DateTime day,
    Duration slotDuration = defaultSlotDuration,
  }) {
    final dayStart = DateTime(day.year, day.month, day.day);
    final dayEnd = dayStart.add(const Duration(days: 1));
    final reserved = <String>{};

    for (final job in jobs) {
      final scheduled = job.scheduledDate;
      if (scheduled == null) continue;
      if (!_blocksSchedule(job.status)) continue;
      if (scheduled.isBefore(dayStart) || !scheduled.isBefore(dayEnd)) {
        continue;
      }

      for (final slot in mockBookableSlots) {
        final slotTime = MockReservedSlots.parse(slot);
        final slotStart = DateTime(
          day.year,
          day.month,
          day.day,
          slotTime.hour,
          slotTime.minute,
        );
        final slotEnd = slotStart.add(slotDuration);
        final jobEnd = scheduled.add(slotDuration);
        final overlaps =
            scheduled.isBefore(slotEnd) && jobEnd.isAfter(slotStart);
        if (overlaps) reserved.add(slot);
      }
    }
    return reserved;
  }

  static bool isReserved(Set<String> reserved, TimeOfDay time) =>
      reserved.contains(MockReservedSlots.format(time));
}
