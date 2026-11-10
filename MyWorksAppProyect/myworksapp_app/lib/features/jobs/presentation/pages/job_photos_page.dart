import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

import '../../../../core/database/models/job_photo_model.dart';
import '../../../../core/database/repositories/job_photo_repository.dart';
import '../../../../core/database/supabase_db.dart';
import '../../../../core/design_system/app_spacing.dart';
import '../../../../core/services/evidence_webp.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/app_snackbar.dart';
import '../../../../core/widgets/design_system/app_gradient_app_bar.dart';
import '../../../../core/widgets/design_system/empty_state_widget.dart';
import '../../../../core/widgets/evidence_photo_image.dart';

class JobPhotosPage extends StatefulWidget {
  final String jobId;
  final bool canAddPhotos;

  const JobPhotosPage({
    super.key,
    required this.jobId,
    this.canAddPhotos = true,
  });

  @override
  State<JobPhotosPage> createState() => _JobPhotosPageState();
}

class _JobPhotosPageState extends State<JobPhotosPage> {
  static const _bucket = 'evidencias-trabajo';

  final JobPhotoRepository _photoRepository = JobPhotoRepository();
  final ImagePicker _imagePicker = ImagePicker();
  List<JobPhotoModel> _photos = [];
  bool _isLoading = true;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    _loadPhotos();
  }

  Future<void> _loadPhotos() async {
    setState(() => _isLoading = true);
    try {
      final photos = await _photoRepository.getPhotosByJobId(widget.jobId);
      if (!mounted) return;
      setState(() {
        _photos = photos;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      showAppSnackBar(
        context,
        'No se pudieron cargar las evidencias.',
        type: AppSnackBarType.error,
      );
    }
  }

  Future<String> _uploadEvidenceFile({
    required Uint8List bytes,
    required String ext,
    required String mediaType,
  }) async {
    final objectPath = '${widget.jobId}/${const Uuid().v4()}.$ext';
    final contentType = mediaType == JobPhotoModel.mediaVideo
        ? 'video/mp4'
        : 'image/webp';

    await supabase.storage.from(_bucket).uploadBinary(
          objectPath,
          bytes,
          fileOptions: FileOptions(
            upsert: false,
            contentType: contentType,
          ),
        );

    return supabase.storage.from(_bucket).getPublicUrl(objectPath);
  }

  Future<void> _savePhoto(Uint8List webpBytes) async {
    final remoteUrl = await _uploadEvidenceFile(
      bytes: webpBytes,
      ext: 'webp',
      mediaType: JobPhotoModel.mediaPhoto,
    );

    final photo = JobPhotoModel(
      id: const Uuid().v4(),
      jobId: widget.jobId,
      photoPath: remoteUrl,
      mediaType: JobPhotoModel.mediaPhoto,
      createdAt: DateTime.now(),
      webpBytes: webpBytes,
    );

    await _photoRepository.createJobPhoto(photo);
    await _loadPhotos();

    if (!mounted) return;
    showAppSnackBar(
      context,
      'Foto subida',
      type: AppSnackBarType.success,
    );
  }

  Future<void> _pickPhoto(ImageSource source) async {
    if (_uploading) return;
    try {
      final XFile? image = await _imagePicker.pickImage(
        source: source,
        imageQuality: 85,
        maxWidth: 1920,
        maxHeight: 1920,
      );
      if (image == null) return;

      setState(() => _uploading = true);
      final raw = await image.readAsBytes();
      final webp = await encodeEvidenceWebp(raw);
      await _savePhoto(webp);
    } catch (e) {
      if (!mounted) return;
      showAppSnackBar(
        context,
        'No se pudo subir la evidencia. Revisa Storage (bucket evidencias-trabajo). $e',
        type: AppSnackBarType.error,
      );
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _pickVideo() async {
    if (_uploading) return;
    try {
      final XFile? video = await _imagePicker.pickVideo(
        source: ImageSource.gallery,
        maxDuration: const Duration(minutes: 3),
      );
      if (video == null) return;

      setState(() => _uploading = true);
      final videoBytes = await video.readAsBytes();
      final remoteUrl = await _uploadEvidenceFile(
        bytes: videoBytes,
        ext: 'mp4',
        mediaType: JobPhotoModel.mediaVideo,
      );

      final photo = JobPhotoModel(
        id: const Uuid().v4(),
        jobId: widget.jobId,
        photoPath: remoteUrl,
        mediaType: JobPhotoModel.mediaVideo,
        createdAt: DateTime.now(),
      );
      await _photoRepository.createJobPhoto(photo);
      await _loadPhotos();
      if (!mounted) return;
      showAppSnackBar(context, 'Video subido', type: AppSnackBarType.success);
    } catch (e) {
      if (!mounted) return;
      showAppSnackBar(
        context,
        'No se pudo subir el video. Revisa Storage (bucket evidencias-trabajo). $e',
        type: AppSnackBarType.error,
      );
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  void _showAddEvidenceSheet() {
    if (_uploading) return;
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera),
              title: const Text('Tomar foto'),
              onTap: () {
                Navigator.pop(ctx);
                _pickPhoto(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Elegir foto de galería'),
              onTap: () {
                Navigator.pop(ctx);
                _pickPhoto(ImageSource.gallery);
              },
            ),
            ListTile(
              leading: const Icon(Icons.videocam),
              title: const Text('Elegir video'),
              onTap: () {
                Navigator.pop(ctx);
                _pickVideo();
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _deletePhoto(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Eliminar evidencia'),
        content: const Text('¿Estás seguro de que quieres eliminar este archivo?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await _photoRepository.deleteJobPhoto(id);
      await _loadPhotos();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppGradientAppBar(
        title: const Text('Evidencia del trabajo'),
        actions: [
          if (widget.canAddPhotos)
            IconButton(
              icon: _uploading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.add_a_photo),
              onPressed: _uploading ? null : _showAddEvidenceSheet,
              tooltip: 'Agregar evidencia',
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _photos.isEmpty
              ? Stack(
                  children: [
                    const EmptyStateWidget(
                      icon: Icons.photo_library,
                      title: 'Sin evidencia',
                      message:
                          'Sube al menos una foto o un video del trabajo realizado',
                    ),
                    if (_uploading) const _UploadingScrim(),
                  ],
                )
              : Stack(
                  children: [
                    GridView.builder(
                      padding: const EdgeInsets.all(AppSpacing.lg),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 3,
                        crossAxisSpacing: 8,
                        mainAxisSpacing: 8,
                      ),
                      itemCount: _photos.length,
                      itemBuilder: (context, index) {
                        final photo = _photos[index];
                        return GestureDetector(
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => _EvidenceViewer(
                                  photo: photo,
                                  onDelete: widget.canAddPhotos
                                      ? () => _deletePhoto(photo.id)
                                      : null,
                                ),
                              ),
                            );
                          },
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              EvidencePhotoImage(photo: photo),
                              if (photo.isVideo)
                                Positioned(
                                  left: 6,
                                  bottom: 6,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                      vertical: 2,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Colors.black54,
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: const Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          Icons.videocam,
                                          color: Colors.white,
                                          size: 14,
                                        ),
                                        SizedBox(width: 4),
                                        Text(
                                          'Video',
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontSize: 11,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              if (widget.canAddPhotos)
                                Positioned(
                                  top: 4,
                                  right: 4,
                                  child: IconButton(
                                    icon: const Icon(
                                      Icons.delete,
                                      color: AppColors.error,
                                    ),
                                    onPressed: () => _deletePhoto(photo.id),
                                    iconSize: 20,
                                    padding: EdgeInsets.zero,
                                    constraints: const BoxConstraints(),
                                  ),
                                ),
                            ],
                          ),
                        );
                      },
                    ),
                    if (_uploading) const _UploadingScrim(),
                  ],
                ),
    );
  }
}

class _UploadingScrim extends StatelessWidget {
  const _UploadingScrim();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: Color(0x66000000),
      child: Center(
        child: CircularProgressIndicator(),
      ),
    );
  }
}

class _EvidenceViewer extends StatelessWidget {
  final JobPhotoModel photo;
  final VoidCallback? onDelete;

  const _EvidenceViewer({
    required this.photo,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(photo.isVideo ? 'Video' : 'Foto'),
        actions: [
          if (onDelete != null)
            IconButton(
              icon: const Icon(Icons.delete, color: AppColors.error),
              onPressed: () {
                onDelete!();
                Navigator.pop(context);
              },
            ),
        ],
      ),
      body: Center(
        child: photo.isVideo
            ? Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.videocam, color: Colors.white, size: 72),
                    const SizedBox(height: 16),
                    Text(
                      'Video registrado como evidencia',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: Colors.white,
                          ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              )
            : InteractiveViewer(
                child: EvidencePhotoImage(
                  photo: photo,
                  fit: BoxFit.contain,
                ),
              ),
      ),
    );
  }
}
