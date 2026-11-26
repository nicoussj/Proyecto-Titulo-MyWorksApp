import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/domain/job_charge_preview.dart';

void main() {
  group('JobChargePreview', () {
    test('fromMap parsea correctamente montos enteros', () {
      final map = {
        'total_clp': 50000,
        'tarifa_clp': 40000,
        'traslado_clp': 10000,
        'comision_clp': 2500,
        'neto_clp': 47500,
      };

      final preview = JobChargePreview.fromMap(map);

      expect(preview.totalClp, 50000);
      expect(preview.serviceClp, 40000);
      expect(preview.transportClp, 10000);
      expect(preview.feeClp, 2500);
      expect(preview.payoutClp, 47500);
    });

    test('fromMap redondea montos decimales', () {
      final map = {
        'total_clp': 50123.7,
        'tarifa_clp': 40000.4,
        'traslado_clp': 10123.3,
        'comision_clp': 2506.2,
        'neto_clp': 47617.5,
      };

      final preview = JobChargePreview.fromMap(map);

      expect(preview.totalClp, 50124);
      expect(preview.serviceClp, 40000);
      expect(preview.transportClp, 10123);
      expect(preview.feeClp, 2506);
      expect(preview.payoutClp, 47618);
    });

    test('fromMap parsea strings numéricos', () {
      final map = {
        'total_clp': '50000',
        'tarifa_clp': '40000',
        'traslado_clp': '10000',
        'comision_clp': '2500',
        'neto_clp': '47500',
      };

      final preview = JobChargePreview.fromMap(map);

      expect(preview.totalClp, 50000);
      expect(preview.serviceClp, 40000);
      expect(preview.transportClp, 10000);
      expect(preview.feeClp, 2500);
      expect(preview.payoutClp, 47500);
    });

    test('fromMap ignora espacios en strings', () {
      final map = {
        'total_clp': '  50000  ',
        'tarifa_clp': ' 40000 ',
        'traslado_clp': '10000',
        'comision_clp': '2500',
        'neto_clp': '47500',
      };

      final preview = JobChargePreview.fromMap(map);

      expect(preview.totalClp, 50000);
      expect(preview.serviceClp, 40000);
    });

    test('fromMap trata valores null como 0', () {
      final map = {
        'total_clp': null,
        'tarifa_clp': 40000,
        'traslado_clp': null,
        'comision_clp': 2500,
        'neto_clp': 47500,
      };

      final preview = JobChargePreview.fromMap(map);

      expect(preview.totalClp, 0);
      expect(preview.transportClp, 0);
    });

    test('fromMap trata strings inválidos como 0', () {
      final map = {
        'total_clp': 'abc',
        'tarifa_clp': 40000,
        'traslado_clp': 'xyz',
        'comision_clp': 2500,
        'neto_clp': 47500,
      };

      final preview = JobChargePreview.fromMap(map);

      expect(preview.totalClp, 0);
      expect(preview.transportClp, 0);
    });

    test('fromMap trata campos faltantes como 0', () {
      final map = {
        'tarifa_clp': 40000,
        'comision_clp': 2500,
      };

      final preview = JobChargePreview.fromMap(map);

      expect(preview.totalClp, 0);
      expect(preview.transportClp, 0);
      expect(preview.payoutClp, 0);
    });

    test('validación matemática: tarifa + traslado = total', () {
      final map = {
        'total_clp': 50000,
        'tarifa_clp': 40000,
        'traslado_clp': 10000,
        'comision_clp': 2500,
        'neto_clp': 47500,
      };

      final preview = JobChargePreview.fromMap(map);

      expect(
        preview.serviceClp + preview.transportClp,
        preview.totalClp,
      );
    });

    test('validación matemática: comisión + neto = total', () {
      final map = {
        'total_clp': 50000,
        'tarifa_clp': 40000,
        'traslado_clp': 10000,
        'comision_clp': 2500,
        'neto_clp': 47500,
      };

      final preview = JobChargePreview.fromMap(map);

      expect(
        preview.feeClp + preview.payoutClp,
        preview.totalClp,
      );
    });

    test('servicio sin traslado', () {
      final map = {
        'total_clp': 30000,
        'tarifa_clp': 30000,
        'traslado_clp': 0,
        'comision_clp': 1500,
        'neto_clp': 28500,
      };

      final preview = JobChargePreview.fromMap(map);

      expect(preview.transportClp, 0);
      expect(preview.totalClp, preview.serviceClp);
    });

    test('comisión del 5% redondeada', () {
      final map = {
        'total_clp': 45000,
        'tarifa_clp': 40000,
        'traslado_clp': 5000,
        'comision_clp': 2250, // 5% de 45000
        'neto_clp': 42750,
      };

      final preview = JobChargePreview.fromMap(map);

      expect(preview.feeClp, 2250);
      expect(preview.payoutClp, 42750);
    });

    test('constructor const permite crear instancia directa', () {
      const preview = JobChargePreview(
        totalClp: 50000,
        serviceClp: 40000,
        transportClp: 10000,
        feeClp: 2500,
        payoutClp: 47500,
      );

      expect(preview.totalClp, 50000);
      expect(preview.serviceClp, 40000);
      expect(preview.transportClp, 10000);
      expect(preview.feeClp, 2500);
      expect(preview.payoutClp, 47500);
    });

    test('fromMap acepta diferentes tipos de number', () {
      final map = {
        'total_clp': 50000.0,
        'tarifa_clp': 40000,
        'traslado_clp': 10000.5,
        'comision_clp': 2500.00,
        'neto_clp': 47500,
      };

      final preview = JobChargePreview.fromMap(map);

      expect(preview.totalClp, 50000);
      expect(preview.transportClp, 10001);
    });
  });
}
