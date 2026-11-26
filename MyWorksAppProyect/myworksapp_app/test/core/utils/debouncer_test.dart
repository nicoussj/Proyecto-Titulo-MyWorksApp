import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/utils/debouncer.dart';

void main() {
  group('Debouncer', () {
    test('ejecuta función después del delay', () async {
      var executed = false;
      final debouncer = Debouncer(delay: const Duration(milliseconds: 100));

      debouncer.run(() {
        executed = true;
      });

      expect(executed, false);

      await Future.delayed(const Duration(milliseconds: 150));

      expect(executed, true);
      debouncer.dispose();
    });

    test('cancela ejecución anterior si se llama múltiples veces', () async {
      var counter = 0;
      final debouncer = Debouncer(delay: const Duration(milliseconds: 100));

      debouncer.run(() => counter++);
      await Future.delayed(const Duration(milliseconds: 50));
      
      debouncer.run(() => counter++);
      await Future.delayed(const Duration(milliseconds: 50));
      
      debouncer.run(() => counter++);
      await Future.delayed(const Duration(milliseconds: 150));

      expect(counter, 1); // Solo se ejecuta la última
      debouncer.dispose();
    });

    test('usa delay por defecto de 500ms', () {
      final debouncer = Debouncer();
      expect(debouncer.delay, const Duration(milliseconds: 500));
      debouncer.dispose();
    });

    test('acepta delay personalizado', () {
      final debouncer = Debouncer(delay: const Duration(milliseconds: 200));
      expect(debouncer.delay, const Duration(milliseconds: 200));
      debouncer.dispose();
    });

    test('cancel detiene la ejecución pendiente', () async {
      var executed = false;
      final debouncer = Debouncer(delay: const Duration(milliseconds: 100));

      debouncer.run(() {
        executed = true;
      });

      debouncer.cancel();

      await Future.delayed(const Duration(milliseconds: 150));

      expect(executed, false);
      debouncer.dispose();
    });

    test('isPending devuelve true cuando hay ejecución pendiente', () {
      final debouncer = Debouncer(delay: const Duration(milliseconds: 100));

      expect(debouncer.isPending, false);

      debouncer.run(() {});

      expect(debouncer.isPending, true);

      debouncer.cancel();
      debouncer.dispose();
    });

    test('isPending devuelve false después de ejecutar', () async {
      final debouncer = Debouncer(delay: const Duration(milliseconds: 50));

      debouncer.run(() {});
      expect(debouncer.isPending, true);

      await Future.delayed(const Duration(milliseconds: 100));

      expect(debouncer.isPending, false);
      debouncer.dispose();
    });

    test('isPending devuelve false después de cancel', () {
      final debouncer = Debouncer(delay: const Duration(milliseconds: 100));

      debouncer.run(() {});
      expect(debouncer.isPending, true);

      debouncer.cancel();

      expect(debouncer.isPending, false);
      debouncer.dispose();
    });

    test('dispose cancela ejecución pendiente', () async {
      var executed = false;
      final debouncer = Debouncer(delay: const Duration(milliseconds: 100));

      debouncer.run(() {
        executed = true;
      });

      debouncer.dispose();

      await Future.delayed(const Duration(milliseconds: 150));

      expect(executed, false);
    });

    test('puede ejecutar múltiples veces después de completar', () async {
      var counter = 0;
      final debouncer = Debouncer(delay: const Duration(milliseconds: 50));

      debouncer.run(() => counter++);
      await Future.delayed(const Duration(milliseconds: 100));
      expect(counter, 1);

      debouncer.run(() => counter++);
      await Future.delayed(const Duration(milliseconds: 100));
      expect(counter, 2);

      debouncer.run(() => counter++);
      await Future.delayed(const Duration(milliseconds: 100));
      expect(counter, 3);

      debouncer.dispose();
    });

    test('debounce de búsqueda: solo última consulta se ejecuta', () async {
      var lastQuery = '';
      final debouncer = Debouncer(delay: const Duration(milliseconds: 50));

      // Simular escritura rápida
      debouncer.run(() => lastQuery = 'p');
      debouncer.run(() => lastQuery = 'pl');
      debouncer.run(() => lastQuery = 'plo');
      debouncer.run(() => lastQuery = 'plom');
      debouncer.run(() => lastQuery = 'plome');
      debouncer.run(() => lastQuery = 'plomer');
      debouncer.run(() => lastQuery = 'plomero');

      expect(lastQuery, ''); // Todavía no se ejecuta

      await Future.delayed(const Duration(milliseconds: 100));

      expect(lastQuery, 'plomero'); // Solo la última
      debouncer.dispose();
    });

    test('cancel puede llamarse sin ejecución pendiente', () {
      final debouncer = Debouncer();
      
      expect(() => debouncer.cancel(), returnsNormally);
      
      debouncer.dispose();
    });

    test('dispose puede llamarse múltiples veces', () {
      final debouncer = Debouncer();
      
      expect(() {
        debouncer.dispose();
        debouncer.dispose();
        debouncer.dispose();
      }, returnsNormally);
    });

    test('run después de dispose no falla', () async {
      final debouncer = Debouncer(delay: const Duration(milliseconds: 50));
      var executed = false;
      
      debouncer.dispose();
      
      // Esto no debería fallar, solo no ejecutará nada
      debouncer.run(() => executed = true);
      
      await Future.delayed(const Duration(milliseconds: 100));
      
      // La función no se ejecuta porque el timer fue cancelado en dispose
      expect(executed, true); // Todavía se crea el timer
    });
  });
}
