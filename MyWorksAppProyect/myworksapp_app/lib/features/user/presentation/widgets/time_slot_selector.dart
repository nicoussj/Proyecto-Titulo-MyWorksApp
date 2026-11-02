import 'package:flutter/material.dart';
import 'package:myworksapp/core/theme/app_colors.dart';
import 'package:myworksapp/core/utils/mock_reserved_slots.dart';

/// Chips de hora. Los bloques de [reservedLabels] se ven deshabilitados
/// y, si se tocan, muestran la alerta de hora ocupada.
class TimeSlotSelector extends StatelessWidget {
  const TimeSlotSelector({
    super.key,
    required this.selected,
    required this.onChanged,
    this.reservedLabels = const <String>{},
  });

  final TimeOfDay? selected;
  final ValueChanged<TimeOfDay> onChanged;
  final Set<String> reservedLabels;

  @override
  Widget build(BuildContext context) {
    final selectedLabel =
        selected == null ? null : MockReservedSlots.format(selected!);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Horario',
          style: Theme.of(context).textTheme.titleSmall,
        ),
        const SizedBox(height: 4),
        Text(
          reservedLabels.isEmpty
              ? 'Elige un horario disponible.'
              : 'Las horas marcadas ya están reservadas para este profesional.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final slot in mockBookableSlots)
              _SlotChip(
                label: slot,
                reserved: reservedLabels.contains(slot),
                selected: selectedLabel == slot,
                onPick: () => onChanged(MockReservedSlots.parse(slot)),
              ),
          ],
        ),
      ],
    );
  }
}

class _SlotChip extends StatelessWidget {
  const _SlotChip({
    required this.label,
    required this.reserved,
    required this.selected,
    required this.onPick,
  });

  final String label;
  final bool reserved;
  final bool selected;
  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    final disabledColor = Theme.of(context).disabledColor;

    return FilterChip(
      label: Text(label),
      avatar: reserved
          ? Icon(Icons.lock_outline, size: 16, color: disabledColor)
          : null,
      selected: selected && !reserved,
      showCheckmark: !reserved,
      // Sigue recibiendo el toque para poder avisar si se fuerza un horario ocupado.
      onSelected: (_) {
        if (reserved) {
          ScaffoldMessenger.of(context)
            ..hideCurrentSnackBar()
            ..showSnackBar(
              const SnackBar(content: Text(MockReservedSlots.reservedMessage)),
            );
          return;
        }
        onPick();
      },
      selectedColor: Theme.of(context).colorScheme.primaryContainer,
      backgroundColor: reserved
          ? disabledColor.withValues(alpha: 0.12)
          : null,
      labelStyle: TextStyle(
        color: reserved ? disabledColor : null,
        decoration: reserved ? TextDecoration.lineThrough : null,
        fontWeight: selected && !reserved ? FontWeight.w700 : FontWeight.w500,
      ),
      side: BorderSide(
        color: reserved
            ? disabledColor.withValues(alpha: 0.45)
            : selected
                ? AppColors.brandOrange
                : Theme.of(context).dividerColor,
      ),
    );
  }
}
