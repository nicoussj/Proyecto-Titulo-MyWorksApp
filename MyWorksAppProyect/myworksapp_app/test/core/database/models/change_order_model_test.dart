import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/database/models/change_order_model.dart';

void main() {
  group('ChangeOrderModel', () {
    test('fromMap parsea correctamente una orden completa', () {
      final map = {
        'id': 'co-123',
        'id_trabajo': 'job-456',
        'id_trabajador': 'worker-789',
        'tipo': 'adicional',
        'titulo': 'Material extra',
        'descripcion': 'Se requieren materiales adicionales no contemplados',
        'monto_clp': 25000,
        'estado': 'pendiente_cliente',
        'id_pago': 'payment-999',
        'creado_en': '2026-11-26T10:00:00Z',
        'respondido_en': '2026-11-26T12:00:00Z',
      };

      final order = ChangeOrderModel.fromMap(map);

      expect(order.id, 'co-123');
      expect(order.jobId, 'job-456');
      expect(order.workerId, 'worker-789');
      expect(order.tipo, 'adicional');
      expect(order.titulo, 'Material extra');
      expect(order.descripcion, 'Se requieren materiales adicionales no contemplados');
      expect(order.montoClp, 25000);
      expect(order.estado, 'pendiente_cliente');
      expect(order.paymentId, 'payment-999');
      expect(order.createdAt, DateTime.parse('2026-11-26T10:00:00Z'));
      expect(order.respondedAt, DateTime.parse('2026-11-26T12:00:00Z'));
    });

    test('fromMap acepta respondedAt null', () {
      final map = {
        'id': 'co-123',
        'id_trabajo': 'job-456',
        'id_trabajador': 'worker-789',
        'tipo': 'descuento',
        'titulo': 'Ajuste de precio',
        'descripcion': 'Descuento por material no usado',
        'monto_clp': -5000,
        'estado': 'pendiente_cliente',
        'creado_en': '2026-11-26T10:00:00Z',
      };

      final order = ChangeOrderModel.fromMap(map);

      expect(order.respondedAt, null);
      expect(order.paymentId, null);
    });

    test('fromMap redondea monto decimal', () {
      final map = {
        'id': 'co-123',
        'id_trabajo': 'job-456',
        'id_trabajador': 'worker-789',
        'tipo': 'adicional',
        'titulo': 'Ajuste',
        'descripcion': 'Test',
        'monto_clp': 25500.7,
        'estado': 'pendiente_cliente',
        'creado_en': '2026-11-26T10:00:00Z',
      };

      final order = ChangeOrderModel.fromMap(map);

      expect(order.montoClp, 25501);
    });

    test('fromMap acepta monto negativo para descuentos', () {
      final map = {
        'id': 'co-123',
        'id_trabajo': 'job-456',
        'id_trabajador': 'worker-789',
        'tipo': 'descuento',
        'titulo': 'Ajuste de precio',
        'descripcion': 'Descuento',
        'monto_clp': -10000,
        'estado': 'pendiente_cliente',
        'creado_en': '2026-11-26T10:00:00Z',
      };

      final order = ChangeOrderModel.fromMap(map);

      expect(order.montoClp, -10000);
    });

    test('toMap serializa correctamente todos los campos', () {
      final createdAt = DateTime.parse('2026-11-26T10:00:00Z');
      final respondedAt = DateTime.parse('2026-11-26T12:00:00Z');
      
      final order = ChangeOrderModel(
        id: 'co-123',
        jobId: 'job-456',
        workerId: 'worker-789',
        tipo: 'adicional',
        titulo: 'Material extra',
        descripcion: 'Se requieren más materiales',
        montoClp: 30000,
        estado: 'pagada',
        paymentId: 'payment-999',
        createdAt: createdAt,
        respondedAt: respondedAt,
      );

      final map = order.toMap();

      expect(map['id'], 'co-123');
      expect(map['id_trabajo'], 'job-456');
      expect(map['id_trabajador'], 'worker-789');
      expect(map['tipo'], 'adicional');
      expect(map['titulo'], 'Material extra');
      expect(map['descripcion'], 'Se requieren más materiales');
      expect(map['monto_clp'], 30000);
      expect(map['estado'], 'pagada');
      expect(map['id_pago'], 'payment-999');
      expect(map['creado_en'], createdAt.toIso8601String());
      expect(map['respondido_en'], respondedAt.toIso8601String());
    });

    test('toMap serializa respondedAt null', () {
      final createdAt = DateTime.parse('2026-11-26T10:00:00Z');
      
      final order = ChangeOrderModel(
        id: 'co-123',
        jobId: 'job-456',
        workerId: 'worker-789',
        tipo: 'adicional',
        titulo: 'Test',
        descripcion: 'Test description',
        montoClp: 15000,
        estado: 'pendiente_cliente',
        createdAt: createdAt,
      );

      final map = order.toMap();

      expect(map['respondido_en'], null);
    });

    test('isPendingClient es true para estado pendiente_cliente', () {
      final order = ChangeOrderModel(
        id: 'co-123',
        jobId: 'job-456',
        workerId: 'worker-789',
        tipo: 'adicional',
        titulo: 'Test',
        descripcion: 'Test',
        montoClp: 10000,
        estado: 'pendiente_cliente',
        createdAt: DateTime.now(),
      );

      expect(order.isPendingClient, true);
      expect(order.isPaid, false);
    });

    test('isPaid es true para estado pagada', () {
      final order = ChangeOrderModel(
        id: 'co-123',
        jobId: 'job-456',
        workerId: 'worker-789',
        tipo: 'adicional',
        titulo: 'Test',
        descripcion: 'Test',
        montoClp: 10000,
        estado: 'pagada',
        createdAt: DateTime.now(),
      );

      expect(order.isPaid, true);
      expect(order.isPendingClient, false);
    });

    test('estados válidos', () {
      final estados = [
        'pendiente_cliente',
        'pagada',
        'rechazada',
        'cancelada',
      ];

      for (final estado in estados) {
        final order = ChangeOrderModel(
          id: 'co-$estado',
          jobId: 'job-1',
          workerId: 'worker-1',
          tipo: 'adicional',
          titulo: 'Test',
          descripcion: 'Test',
          montoClp: 10000,
          estado: estado,
          createdAt: DateTime.now(),
        );

        expect(order.estado, estado);
      }
    });

    test('tipos válidos', () {
      final tipos = ['adicional', 'descuento', 'cambio_alcance'];

      for (final tipo in tipos) {
        final order = ChangeOrderModel(
          id: 'co-$tipo',
          jobId: 'job-1',
          workerId: 'worker-1',
          tipo: tipo,
          titulo: 'Test',
          descripcion: 'Test',
          montoClp: 10000,
          estado: 'pendiente_cliente',
          createdAt: DateTime.now(),
        );

        expect(order.tipo, tipo);
      }
    });

    test('idempotencia de serialización', () {
      final original = ChangeOrderModel(
        id: 'co-123',
        jobId: 'job-456',
        workerId: 'worker-789',
        tipo: 'adicional',
        titulo: 'Material extra',
        descripcion: 'Descripción detallada',
        montoClp: 20000,
        estado: 'pagada',
        paymentId: 'payment-999',
        createdAt: DateTime.parse('2026-11-26T10:00:00Z'),
        respondedAt: DateTime.parse('2026-11-26T12:00:00Z'),
      );

      final map = original.toMap();
      final reconstructed = ChangeOrderModel.fromMap(map);

      expect(reconstructed.id, original.id);
      expect(reconstructed.jobId, original.jobId);
      expect(reconstructed.workerId, original.workerId);
      expect(reconstructed.tipo, original.tipo);
      expect(reconstructed.titulo, original.titulo);
      expect(reconstructed.descripcion, original.descripcion);
      expect(reconstructed.montoClp, original.montoClp);
      expect(reconstructed.estado, original.estado);
      expect(reconstructed.paymentId, original.paymentId);
      expect(reconstructed.createdAt, original.createdAt);
      expect(reconstructed.respondedAt, original.respondedAt);
    });
  });
}
