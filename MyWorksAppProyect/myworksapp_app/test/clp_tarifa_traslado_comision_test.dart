import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/domain/clp_rounding.dart';
import 'package:myworksapp/core/services/pricing_service.dart';

/// Misma regla que `comision_servicio_clp`: 5 % half-away, mínimo $1.000
/// y nunca más que el bruto. El cliente paga tarifa + traslado; la comisión
/// se descuenta una sola vez sobre esa suma.
int comisionSobreElPago(int bruto) {
  if (bruto <= 0) return 0;
  final percent = roundHalfAway(bruto * 5, 100);
  final withMinimum = percent < PricingService.minServiceFeeClp
      ? PricingService.minServiceFeeClp
      : percent;
  return withMinimum > bruto ? bruto : withMinimum;
}

void main() {
  final pricing = PricingService.instance;

  void expectIdentidad(int tarifa, int traslado) {
    final quote = pricing.calculateVisitBooking(
      visitFeeClp: tarifa,
      transportExtraClp: traslado,
    );
    final lines = pricing.workerChargeLines(quote);
    final total = tarifa + (traslado < 0 ? 0 : traslado);

    expect(quote.totalClp, total, reason: 'el cliente no paga la comisión');
    expect(quote.subtotalClp, quote.totalClp);
    expect(lines.serviceClp, tarifa.clamp(0, total));
    expect(lines.serviceClp! + lines.transportClp, lines.totalClp);
    expect(lines.feeClp + lines.payoutClp, lines.totalClp);
    expect(lines.totalClp, quote.totalClp);
    expect(lines.feeClp, comisionSobreElPago(lines.totalClp));
    expect(lines.feeClp, pricing.serviceFeeFor(lines.totalClp));
    expect(lines.payoutClp, lines.totalClp - lines.feeClp);
    expect(quote.platformFeeClp, lines.feeClp);
    expect(quote.workerPayoutClp, lines.payoutClp);
  }

  test('tarifa, traslado y comisión cierran en pesos enteros', () {
    const casos = <(int, int)>[
      (32000, 0),
      (32000, 3600),
      (19999, 0),
      (20000, 0),
      (20010, 0),
      (15000, 3000),
      (10000, 10000),
      (1, 0),
      (500, 400),
      (65000, 18000),
      (0, 0),
      (25000, 1),
    ];
    for (final (tarifa, traslado) in casos) {
      expectIdentidad(tarifa, traslado);
    }
  });

  test('el 5 % se cobra sobre la suma, no tarifa y traslado por separado', () {
    const tarifa = 10000;
    const traslado = 10000;
    final quote = pricing.calculateVisitBooking(
      visitFeeClp: tarifa,
      transportExtraClp: traslado,
    );
    final porSeparado =
        pricing.serviceFeeFor(tarifa) + pricing.serviceFeeFor(traslado);

    expect(quote.totalClp, 20000);
    expect(quote.platformFeeClp, 1000);
    expect(porSeparado, 2000);
    expect(quote.platformFeeClp, isNot(porSeparado));
    expect(quote.feeDeductedFromWorker, isTrue);
    expect(quote.platformFeeClp + quote.workerPayoutClp!, quote.totalClp);
  });

  test('el medio peso de la comisión sube y el mínimo no deja saldo', () {
    expect(pricing.serviceFeeFor(20010), 1001);
    expect(20010 - pricing.serviceFeeFor(20010), 19009);
    expect(1001 + 19009, 20010);

    expect(pricing.serviceFeeFor(19999), 1000);
    expect(1000 + (19999 - 1000), 19999);

    expect(pricing.serviceFeeFor(10), 10);
    expect(pricing.serviceFeeFor(0), 0);
    expect(pricing.serviceFeeFor(32000), 1600);
    expect(1600 + (32000 - 1600), 32000);
  });

  test('un traslado negativo no mueve la tarifa ni abre un peso de diferencia', () {
    expectIdentidad(32000, -5000);
    final quote = pricing.calculateVisitBooking(
      visitFeeClp: 32000,
      transportExtraClp: -5000,
    );
    expect(quote.totalClp, 32000);
    expect(pricing.workerChargeLines(quote).transportClp, 0);
    expect(quote.platformFeeClp, 1600);
  });

  test('barrido de tarifas y traslados: comisión + neto siempre es el total', () {
    const traslados = [0, 3000, 11999];
    for (var tarifa = 0; tarifa <= 40000; tarifa += 37) {
      for (final traslado in traslados) {
        expectIdentidad(tarifa, traslado);
      }
    }
  });
}
