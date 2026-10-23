import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/domain/transport_surcharge.dart';

void main() {
  test('Pelluco queda cerca del centro y no cobra traslado', () {
    final quote = transportSurcharge(
      workerLat: -41.4718,
      workerLng: -72.9396,
      jobLat: -41.4874,
      jobLng: -72.8993,
      radiusKm: kNearbyServiceRadiusKm,
    );
    expect(quote.insideRadar, isTrue);
    expect(quote.extraClp, 0);
  });

  test('Chamiza queda fuera del radar cercano y cobra extra', () {
    final quote = transportSurcharge(
      workerLat: -41.4718,
      workerLng: -72.9396,
      jobLat: -41.4499,
      jobLng: -72.8148,
      radiusKm: kNearbyServiceRadiusKm,
    );
    expect(quote.insideRadar, isFalse);
    expect(quote.extraClp, greaterThanOrEqualTo(kTransportMinSurchargeClp));
    expect(withinTravelRange(quote.distanceKm), isTrue);
  });
}
