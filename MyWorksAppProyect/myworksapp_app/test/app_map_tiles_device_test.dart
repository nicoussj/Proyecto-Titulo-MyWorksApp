// El mapa como en el teléfono (sin el atajo de pruebas), con la red simulada:
// estilo Positron OK, estilo caído con respaldo OpenStreetMap, baldosas que
// bajan, quedan en caché o fallan a una baldosa en blanco. Nada sale a la red.
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_vector_tiles/flutter_map_vector_tiles.dart' as vt;
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:latlong2/latlong.dart';
import 'package:myworksapp/core/map/app_map_tiles.dart';

import 'support/fake_plugins.dart';

const _style = {
  'version': 8,
  'name': 'positron-prueba',
  'sources': {
    'openmaptiles': {
      'type': 'vector',
      'tiles': ['https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf'],
      'maxzoom': 14,
    },
  },
  'layers': [
    {
      'id': 'fondo',
      'type': 'background',
      'paint': {'background-color': '#f2f3f0'}
    },
  ],
};

/// El cliente de baldosas es estático: una sola red falsa para todo el archivo.
final _net = _Net();

class _Net {
  bool styleOk = true;
  int tileStatus = 200;
  final List<String> urls = [];

  void reset({bool styleOk = true, int tileStatus = 200}) {
    this.styleOk = styleOk;
    this.tileStatus = tileStatus;
    urls.clear();
  }

  late final client = MockClient((request) async {
    final url = request.url.toString();
    urls.add(url);
    if (url.startsWith(AppMapTiles.styleUrl)) {
      return styleOk
          ? http.Response(jsonEncode(_style), 200,
              headers: {'content-type': 'application/json'})
          : http.Response('caido', 503);
    }
    if (url.contains('tile.openstreetmap.org')) {
      return tileStatus == 200
          ? http.Response.bytes(blankMapTilePng, 200)
          : http.Response('', tileStatus);
    }
    return http.Response('', 404);
  });
}

Widget _map() => const MaterialApp(
      home: SizedBox(
        width: 300,
        height: 300,
        child: FlutterMap(
          options: MapOptions(
              initialCenter: LatLng(-41.47, -72.94), initialZoom: 13),
          children: [AppMapTiles(), MapTileCredits()],
        ),
      ),
    );

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester
        .runAsync(() => Future<void>.delayed(const Duration(milliseconds: 60)));
    await tester.pump(const Duration(milliseconds: 300));
  }
}

void main() {
  setUp(() {
    installFakePlugins();
    // Las baldosas son ImageProvider: sin esto Flutter reusa las de otro test.
    imageCache
      ..clear()
      ..clearLiveImages();
    MapTileCache.debugReset();
    MapTileCache.debugInWidgetTestOverride = false;
  });
  tearDown(MapTileCache.debugReset);

  testWidgets('con el estilo disponible dibuja la capa vectorial',
      (tester) async {
    final net = _net..reset();
    await http.runWithClient(() async {
      await tester.pumpWidget(_map());
      await _settle(tester);
    }, () => net.client);
    expect(find.byType(vt.VectorTileLayer), findsOneWidget);
    expect(find.text(AppMapTiles.attribution), findsOneWidget);
    expect(MapTileCache.served, greaterThan(0));
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('si el estilo cae usa OpenStreetMap y guarda las baldosas',
      (tester) async {
    final net = _net..reset(styleOk: false);
    await http.runWithClient(() async {
      await tester.pumpWidget(_map());
      await _settle(tester);
      expect(find.byType(vt.VectorTileLayer), findsNothing);
      expect(find.byType(TileLayer), findsOneWidget);
      expect(net.urls.where((u) => u.contains('tile.openstreetmap.org')),
          isNotEmpty);
      final tile =
          net.urls.firstWhere((u) => u.contains('tile.openstreetmap.org'));
      expect(MapTileCache.get(tile), isNotNull);

      // Un segundo mapa reutiliza las baldosas en caché.
      final before = net.urls.length;
      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(_map());
      await _settle(tester);
      expect(net.urls.skip(before).where((u) => u.contains('/13/')), isEmpty);
      await tester.pumpWidget(const SizedBox());
    }, () => net.client);
  });

  testWidgets('una baldosa que falla queda en blanco y no entra a la caché',
      (tester) async {
    final net = _net..reset(styleOk: false, tileStatus: 500);
    await http.runWithClient(() async {
      await tester.pumpWidget(_map());
      await _settle(tester);
      final tiles =
          net.urls.where((u) => u.contains('tile.openstreetmap.org')).toList();
      expect(tiles, isNotEmpty);
      expect(MapTileCache.get(tiles.first), isNull);
      await tester.pumpWidget(const SizedBox());
    }, () => net.client);
  });

  testWidgets('avisa a quien espera la primera baldosa servida',
      (tester) async {
    var calls = 0;
    void waiter() => calls++;
    void cancelled() => calls += 100;
    MapTileCache.whenServed(waiter);
    MapTileCache.whenServed(cancelled);
    MapTileCache.cancel(cancelled);
    await tester.pumpWidget(const SizedBox());
    MapTileCache.put(
        'https://tile.openstreetmap.org/1/1/1.png', Uint8List.fromList([1]));
    tester.binding.scheduleFrame();
    await tester.pump();
    expect(calls, 1);
    // Con baldosas ya servidas avisa en el siguiente frame.
    MapTileCache.whenServed(waiter);
    tester.binding.scheduleFrame();
    await tester.pump();
    expect(calls, 2);
    MapTileCache.put('https://tile.openstreetmap.org/1/1/2.png', Uint8List(0));
    expect(MapTileCache.served, 1);
  });

  testWidgets('en pruebas normales no pide red y pinta baldosas en blanco', (
    tester,
  ) async {
    MapTileCache.debugInWidgetTestOverride = null;
    final net = _net..reset();
    await http.runWithClient(() async {
      await tester.pumpWidget(
        MaterialApp(
          home: SizedBox(
            width: 300,
            height: 300,
            child: FlutterMap(
              options: const MapOptions(
                initialCenter: LatLng(-41.47, -72.94),
                initialZoom: 13,
              ),
              children: [
                AppMapTiles(key: UniqueKey()),
                MapTileCredits(key: UniqueKey()),
              ],
            ),
          ),
        ),
      );
      await _settle(tester);
    }, () => net.client);
    expect(find.byType(TileLayer), findsOneWidget);
    expect(net.urls, isEmpty);
    await tester.pumpWidget(const SizedBox());
  });
}
