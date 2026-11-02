import 'dart:math' show Point;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' as ll;

import '../../../../core/database/models/user_model.dart';
import '../../../../core/database/models/worker_model.dart';
import '../../../../core/domain/transport_surcharge.dart';
import '../../../../core/domain/worker_highlight.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/profile_avatar_picker.dart';

/// Mismo mapa que la web: OpenStreetMap, pines, radar de traslado y punto del trabajo.
class WorkerSearchMap extends StatefulWidget {
  const WorkerSearchMap({
    super.key,
    required this.workers,
    required this.users,
    required this.onSelectWorker,
    this.selectedWorkerId,
    this.clientLatitude,
    this.clientLongitude,
    this.categoryLabel,
    this.onPickClientLocation,
    this.onOpenWorker,
    this.addressController,
    this.onSearchAddress,
    this.onUseGps,
    this.locatingGps = false,
    this.locatingAddress = false,
    this.showSelectedCard = true,
    this.showLocationBar = true,
    this.interactive = true,
  });

  final List<WorkerModel> workers;
  final Map<String, UserModel> users;
  final String? selectedWorkerId;
  final double? clientLatitude;
  final double? clientLongitude;
  final String? categoryLabel;
  final ValueChanged<WorkerModel> onSelectWorker;
  final void Function(double latitude, double longitude)? onPickClientLocation;
  final ValueChanged<WorkerModel>? onOpenWorker;
  final TextEditingController? addressController;
  final VoidCallback? onSearchAddress;
  final VoidCallback? onUseGps;
  final bool locatingGps;
  final bool locatingAddress;
  final bool showSelectedCard;
  final bool showLocationBar;
  final bool interactive;

  @override
  State<WorkerSearchMap> createState() => _WorkerSearchMapState();
}

class _WorkerSearchMapState extends State<WorkerSearchMap> {
  final _map = MapController();
  DateTime? _ignoreMapTapUntil;
  bool _draggingClient = false;
  ll.LatLng? _clientDrag;

  static const _fallback = ll.LatLng(-41.4717, -72.9366);
  static const _clientColor = Color(0xFF2563EB);
  static const _eliteColor = Color(0xFFB45309);

  List<WorkerModel> get _placed => widget.workers
      .where(
        (w) =>
            w.baseLatitude != null &&
            w.baseLongitude != null &&
            w.baseLatitude!.isFinite &&
            w.baseLongitude!.isFinite,
      )
      .toList();

  WorkerModel? get _selected {
    for (final worker in widget.workers) {
      if (worker.userId == widget.selectedWorkerId) return worker;
    }
    return _placed.isNotEmpty ? _placed.first : null;
  }

  bool get _hasClient =>
      widget.clientLatitude != null && widget.clientLongitude != null;

  ll.LatLng? get _clientPoint {
    if (_clientDrag != null) return _clientDrag;
    if (!_hasClient) return null;
    return ll.LatLng(widget.clientLatitude!, widget.clientLongitude!);
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _fit());
  }

  @override
  void dispose() {
    try {
      _map.dispose();
    } catch (_) {}
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant WorkerSearchMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    final selectionChanged =
        oldWidget.selectedWorkerId != widget.selectedWorkerId;
    final setChanged = oldWidget.workers.length != widget.workers.length;
    final clientChanged = oldWidget.clientLatitude != widget.clientLatitude ||
        oldWidget.clientLongitude != widget.clientLongitude;
    if (!_draggingClient && (selectionChanged || setChanged || clientChanged)) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _fit());
    }
  }

  void _fit() {
    if (!mounted) return;
    try {
      final selected = _selected;
      final selectedPoint = _pointOf(selected);
      final explicitSelection = widget.selectedWorkerId != null &&
          selected?.userId == widget.selectedWorkerId;
      if (explicitSelection && selected != null && selectedPoint != null) {
        final radiusKm = resolveServiceRadiusKm(selected.serviceRadiusKm);
        final delta = radiusKm / 111.0;
        final bounds = LatLngBounds(
          ll.LatLng(selectedPoint.latitude - delta, selectedPoint.longitude - delta),
          ll.LatLng(selectedPoint.latitude + delta, selectedPoint.longitude + delta),
        );
        final clientPoint = _clientPoint;
        if (clientPoint != null) {
          bounds.extend(clientPoint);
        }
        _map.fitCamera(
          CameraFit.bounds(
            bounds: bounds,
            padding: const EdgeInsets.fromLTRB(28, 48, 28, 72),
            maxZoom: 14.5,
          ),
        );
        return;
      }

      final clientPoint = _clientPoint;
      final points = <ll.LatLng>[
        for (final worker in _placed) _pointOf(worker)!,
        if (clientPoint != null) clientPoint,
      ];
      if (points.isEmpty) {
        _map.move(_fallback, 12);
        return;
      }
      if (points.length == 1) {
        _map.move(points.first, 14);
        return;
      }
      _map.fitCamera(
        CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(points),
          padding: const EdgeInsets.fromLTRB(24, 40, 24, 64),
          maxZoom: 14,
        ),
      );
    } catch (_) {
      // El mapa todavía no tiene cámara (primer frame).
    }
  }

  ll.LatLng? _pointOf(WorkerModel? worker) {
    if (worker?.baseLatitude == null || worker?.baseLongitude == null) {
      return null;
    }
    return ll.LatLng(worker!.baseLatitude!, worker.baseLongitude!);
  }

  void _onMarkerTap(WorkerModel worker) {
    _ignoreMapTapUntil = DateTime.now().add(const Duration(milliseconds: 400));
    widget.onSelectWorker(worker);
  }

  void _onMapTap(TapPosition _, ll.LatLng point) {
    if (widget.onPickClientLocation == null) return;
    if (_draggingClient) return;
    if (_ignoreMapTapUntil != null &&
        DateTime.now().isBefore(_ignoreMapTapUntil!)) {
      return;
    }
    widget.onPickClientLocation!(point.latitude, point.longitude);
  }

  void _onClientPanStart() {
    if (widget.onPickClientLocation == null || !widget.interactive) return;
    final point = _clientPoint;
    if (point == null) return;
    setState(() {
      _draggingClient = true;
      _clientDrag = point;
    });
  }

  void _onClientPanUpdate(DragUpdateDetails details) {
    if (!_draggingClient || _clientDrag == null) return;
    try {
      final camera = _map.camera;
      final current = camera.latLngToScreenPoint(_clientDrag!);
      final next = camera.pointToLatLng(
        Point(current.x + details.delta.dx, current.y + details.delta.dy),
      );
      setState(() => _clientDrag = next);
    } catch (_) {}
  }

  void _onClientPanEnd() {
    final point = _clientDrag;
    _ignoreMapTapUntil = DateTime.now().add(const Duration(milliseconds: 400));
    setState(() {
      _draggingClient = false;
      _clientDrag = null;
    });
    if (point != null) {
      widget.onPickClientLocation?.call(point.latitude, point.longitude);
    }
  }

  void _zoomBy(double delta) {
    try {
      _map.move(_map.camera.center, (_map.camera.zoom + delta).clamp(4.0, 18.0));
    } catch (_) {}
  }

  String _badgeText() {
    final placed = _placed.length;
    if (placed == 0) return 'Ningún profesional tiene ubicación base todavía';
    final label = widget.categoryLabel?.trim();
    if (label != null && label.isNotEmpty) {
      return '$placed en el mapa · $label';
    }
    return '$placed en el mapa';
  }

  @override
  Widget build(BuildContext context) {
    final selected = _selected;
    final selectedPoint = _pointOf(selected);
    final showRadar = selected != null &&
        selectedPoint != null &&
        widget.selectedWorkerId == selected.userId;
    final radiusKm = selected == null
        ? kNearbyServiceRadiusKm
        : resolveServiceRadiusKm(selected.serviceRadiusKm);
    final coverage = selected == null
        ? null
        : coverageNotice(
            worker: selected,
            clientLatitude: widget.clientLatitude,
            clientLongitude: widget.clientLongitude,
          );

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxHeight < 240;
          final showCard = widget.showSelectedCard && selected != null && !compact;
          final showLocation = widget.showLocationBar &&
              widget.addressController != null &&
              widget.onSearchAddress != null;

          return Stack(
            fit: StackFit.expand,
            children: [
              FlutterMap(
                mapController: _map,
                options: MapOptions(
                  initialCenter: selectedPoint ??
                      (_clientPoint ??
                          (_placed.isNotEmpty
                              ? _pointOf(_placed.first)!
                              : _fallback)),
                  initialZoom: 13,
                  onMapReady: _fit,
                  onTap: widget.interactive ? _onMapTap : null,
                  interactionOptions: InteractionOptions(
                    flags: widget.interactive && !_draggingClient
                        ? InteractiveFlag.all & ~InteractiveFlag.rotate
                        : InteractiveFlag.none,
                    cursorKeyboardRotationOptions:
                        CursorKeyboardRotationOptions.disabled(),
                  ),
                ),
                children: [
                  TileLayer(
                    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.myworksapp.myworksapp',
                    maxZoom: 19,
                  ),
                  if (showRadar)
                    CircleLayer(
                      circles: [
                        CircleMarker(
                          point: selectedPoint,
                          radius: radiusKm * 1000,
                          useRadiusInMeter: true,
                          color: AppColors.brandOrange.withValues(alpha: 0.12),
                          borderColor: AppColors.brandOrange,
                          borderStrokeWidth: 2,
                        ),
                      ],
                    ),
                  MarkerLayer(
                    markers: [
                      for (final worker in _placed)
                        Marker(
                          point: _pointOf(worker)!,
                          width: worker.userId == widget.selectedWorkerId ? 40 : 30,
                          height:
                              worker.userId == widget.selectedWorkerId ? 40 : 30,
                          child: GestureDetector(
                            onTap: () => _onMarkerTap(worker),
                            child: _MapPin(
                              selected: worker.userId == widget.selectedWorkerId,
                              elite: isEliteWorker(worker),
                              eliteColor: _eliteColor,
                            ),
                          ),
                        ),
                      if (_clientPoint != null)
                        Marker(
                          point: _clientPoint!,
                          width: 44,
                          height: 44,
                          child: GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onPanStart: widget.interactive
                                ? (_) => _onClientPanStart()
                                : null,
                            onPanUpdate: widget.interactive
                                ? _onClientPanUpdate
                                : null,
                            onPanEnd: widget.interactive
                                ? (_) => _onClientPanEnd()
                                : null,
                            onPanCancel: widget.interactive
                                ? _onClientPanEnd
                                : null,
                            child: const _MapPin(
                              selected: false,
                              elite: false,
                              client: true,
                              eliteColor: _eliteColor,
                              clientColor: _clientColor,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
              Positioned(
                top: 10,
                left: 10,
                right: compact ? 48 : 10,
                child: _MapChip(text: _badgeText()),
              ),
              if (!compact)
                const Positioned(
                  top: 10,
                  right: 10,
                  child: _MapLegend(),
                ),
              Positioned(
                right: 10,
                top: compact ? 48 : 52,
                child: _ZoomControls(
                  onIn: () => _zoomBy(1),
                  onOut: () => _zoomBy(-1),
                ),
              ),
              Positioned(
                left: 10,
                right: 10,
                bottom: 10,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (showCard) ...[
                      _SelectedWorkerCard(
                        worker: selected,
                        user: widget.users[selected.userId],
                        coverage: coverage?.text ??
                            'Hasta ${radiusKm.round()} km sin extra de traslado',
                        onOpen: widget.onOpenWorker == null
                            ? null
                            : () => widget.onOpenWorker!(selected),
                      ),
                      const SizedBox(height: 8),
                    ],
                    if (compact) const _MapLegend(),
                    if (compact && showLocation) const SizedBox(height: 8),
                    if (showLocation)
                      _MapLocationBar(
                        controller: widget.addressController!,
                        locatingGps: widget.locatingGps,
                        locatingAddress: widget.locatingAddress,
                        hasClient: _clientPoint != null,
                        compact: compact,
                        onSearch: widget.onSearchAddress!,
                        onGps: widget.onUseGps,
                      ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _MapPin extends StatelessWidget {
  const _MapPin({
    required this.selected,
    required this.elite,
    required this.eliteColor,
    this.client = false,
    this.clientColor = const Color(0xFF2563EB),
  });

  final bool selected;
  final bool elite;
  final bool client;
  final Color eliteColor;
  final Color clientColor;

  @override
  Widget build(BuildContext context) {
    final color = client
        ? clientColor
        : selected
            ? AppColors.brandOrange
            : elite
                ? eliteColor
                : AppColors.brandOrange;
    final size = selected ? 22.0 : 16.0;
    return Center(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 2.5),
          boxShadow: [
            BoxShadow(
              color: color.withValues(alpha: 0.45),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
            BoxShadow(
              color: color.withValues(alpha: 0.22),
              spreadRadius: selected ? 5 : 4,
            ),
          ],
        ),
      ),
    );
  }
}

class _MapChip extends StatelessWidget {
  const _MapChip({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Material(
        color: const Color(0xF00F172A),
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
          ),
        ),
      ),
    );
  }
}

class _ZoomControls extends StatelessWidget {
  const _ZoomControls({required this.onIn, required this.onOut});

  final VoidCallback onIn;
  final VoidCallback onOut;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.94),
      borderRadius: BorderRadius.circular(10),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            visualDensity: VisualDensity.compact,
            tooltip: 'Acercar',
            onPressed: onIn,
            icon: const Icon(Icons.add, size: 18),
          ),
          IconButton(
            visualDensity: VisualDensity.compact,
            tooltip: 'Alejar',
            onPressed: onOut,
            icon: const Icon(Icons.remove, size: 18),
          ),
        ],
      ),
    );
  }
}

class _MapLocationBar extends StatelessWidget {
  const _MapLocationBar({
    required this.controller,
    required this.locatingGps,
    required this.locatingAddress,
    required this.hasClient,
    required this.compact,
    required this.onSearch,
    this.onGps,
  });

  final TextEditingController controller;
  final bool locatingGps;
  final bool locatingAddress;
  final bool hasClient;
  final bool compact;
  final VoidCallback onSearch;
  final VoidCallback? onGps;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          color: const Color(0xF00F172A),
          borderRadius: BorderRadius.circular(24),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 6, 6, 6),
            child: Row(
              children: [
                const Icon(Icons.location_on, color: Colors.white70, size: 16),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: controller,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => onSearch(),
                    cursorColor: AppColors.brandOrange,
                    decoration: const InputDecoration(
                      isDense: true,
                      border: InputBorder.none,
                      hintText: 'Calle, barrio o ciudad',
                      hintStyle: TextStyle(color: Colors.white54, fontSize: 13),
                    ),
                  ),
                ),
                FilledButton(
                  onPressed: locatingAddress ? null : onSearch,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.brandOrange,
                    visualDensity: VisualDensity.compact,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                  ),
                  child: Text(locatingAddress ? '…' : 'Buscar'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        Material(
          color: const Color(0xE00F172A),
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(4, 4, 10, 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextButton.icon(
                  onPressed: locatingGps ? null : onGps,
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.white,
                    visualDensity: VisualDensity.compact,
                  ),
                  icon: locatingGps
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.my_location, size: 16),
                  label: Text(
                    locatingGps
                        ? 'Leyendo GPS…'
                        : hasClient
                            ? 'Ubicación lista'
                            : 'Usar GPS',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                if (!compact) ...[
                  const SizedBox(width: 4),
                  const Text(
                    'o marca / arrastra el pin azul',
                    style: TextStyle(color: Colors.white70, fontSize: 11),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _SelectedWorkerCard extends StatelessWidget {
  const _SelectedWorkerCard({
    required this.worker,
    required this.user,
    required this.coverage,
    this.onOpen,
  });

  final WorkerModel worker;
  final UserModel? user;
  final String coverage;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    final name = user?.name ?? 'Profesional';
    final price = worker.visitFee.round();
    return Material(
      color: const Color(0xF20F172A),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(10, 8, 8, 8),
          child: Row(
            children: [
              ProfileAvatarView(
                displayName: name,
                photoPath: user?.profilePhotoPath,
                radius: 20,
                onDarkBackground: true,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                    Text(
                      '${worker.profession} · ${resolveServiceRadiusKm(worker.serviceRadiusKm).round()} km sin extra',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                      ),
                    ),
                    Text(
                      coverage,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.brandOrange,
                        fontWeight: FontWeight.w600,
                        fontSize: 11,
                      ),
                    ),
                    Text(
                      'Desde \$${_thousands(price)} / visita',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              if (onOpen != null)
                TextButton(
                  onPressed: onOpen,
                  style: TextButton.styleFrom(foregroundColor: Colors.white),
                  child: const Text('Ver perfil'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MapLegend extends StatelessWidget {
  const _MapLegend();

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xD90F172A),
      borderRadius: BorderRadius.circular(20),
      child: const Padding(
        padding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Wrap(
          spacing: 12,
          runSpacing: 4,
          children: [
            _LegendDot(color: AppColors.brandOrange, label: 'Profesionales'),
            _LegendDot(color: Color(0xFFB45309), label: 'Élite'),
            _LegendDot(color: Color(0xFF2563EB), label: 'Tu trabajo'),
            _LegendDot(
              color: AppColors.brandOrange,
              label: 'Área sin extra',
              ring: true,
            ),
          ],
        ),
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({
    required this.color,
    required this.label,
    this.ring = false,
  });

  final Color color;
  final String label;
  final bool ring;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: ring ? color.withValues(alpha: 0.18) : color,
            border: Border.all(color: color, width: ring ? 2 : 0),
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

String _thousands(int amount) {
  final raw = amount.abs().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < raw.length; i++) {
    if (i > 0 && (raw.length - i) % 3 == 0) buffer.write('.');
    buffer.write(raw[i]);
  }
  return '$buffer';
}
