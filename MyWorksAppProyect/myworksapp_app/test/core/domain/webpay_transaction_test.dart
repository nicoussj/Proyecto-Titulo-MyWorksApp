import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/domain/webpay_transaction.dart';

void main() {
  group('WebpayTransactionResponse', () {
    test('fromMap parsea correctamente una respuesta completa', () {
      final map = {
        'token': 'token_webpay_abc123',
        'url': 'https://webpay.test/pay',
        'buyOrder': 'ORDER-2026-11-26-001',
        'paymentId': 'payment-456',
        'redirectUrl': 'https://app.myworks.cl/return',
      };

      final response = WebpayTransactionResponse.fromMap(map);

      expect(response.token, 'token_webpay_abc123');
      expect(response.url, 'https://webpay.test/pay');
      expect(response.buyOrder, 'ORDER-2026-11-26-001');
      expect(response.paymentId, 'payment-456');
      expect(response.redirectUrl, 'https://app.myworks.cl/return');
    });

    test('fromMap parsea buyOrder con snake_case', () {
      final map = {
        'token': 'token_123',
        'url': 'https://webpay.test/pay',
        'buy_order': 'ORDER-SNAKE-CASE',
      };

      final response = WebpayTransactionResponse.fromMap(map);

      expect(response.buyOrder, 'ORDER-SNAKE-CASE');
    });

    test('fromMap prioriza buyOrder sobre buy_order', () {
      final map = {
        'token': 'token_123',
        'url': 'https://webpay.test/pay',
        'buyOrder': 'ORDER-CAMEL',
        'buy_order': 'ORDER-SNAKE',
      };

      final response = WebpayTransactionResponse.fromMap(map);

      expect(response.buyOrder, 'ORDER-CAMEL');
    });

    test('fromMap acepta redirectUrl null', () {
      final map = {
        'token': 'token_123',
        'url': 'https://webpay.test/pay',
        'buyOrder': 'ORDER-123',
      };

      final response = WebpayTransactionResponse.fromMap(map);

      expect(response.redirectUrl, null);
    });

    test('fromMap acepta redirectUrl vacío como null', () {
      final map = {
        'token': 'token_123',
        'url': 'https://webpay.test/pay',
        'buyOrder': 'ORDER-123',
        'redirectUrl': '',
      };

      final response = WebpayTransactionResponse.fromMap(map);

      expect(response.redirectUrl, null);
    });

    test('fromMap con redirectUrl válido no requiere token ni url', () {
      final map = {
        'buyOrder': 'ORDER-123',
        'redirectUrl': 'https://app.myworks.cl/return?token=abc',
      };

      final response = WebpayTransactionResponse.fromMap(map);

      expect(response.redirectUrl, 'https://app.myworks.cl/return?token=abc');
      expect(response.token, '');
      expect(response.url, '');
    });

    test('fromMap lanza FormatException si falta buyOrder', () {
      final map = {
        'token': 'token_123',
        'url': 'https://webpay.test/pay',
      };

      expect(
        () => WebpayTransactionResponse.fromMap(map),
        throwsA(isA<FormatException>()),
      );
    });

    test('fromMap lanza FormatException si falta token sin redirectUrl', () {
      final map = {
        'buyOrder': 'ORDER-123',
        'url': 'https://webpay.test/pay',
      };

      expect(
        () => WebpayTransactionResponse.fromMap(map),
        throwsA(isA<FormatException>()),
      );
    });

    test('fromMap lanza FormatException si falta url sin redirectUrl', () {
      final map = {
        'buyOrder': 'ORDER-123',
        'token': 'token_123',
      };

      expect(
        () => WebpayTransactionResponse.fromMap(map),
        throwsA(isA<FormatException>()),
      );
    });

    test('fromMap convierte valores a string', () {
      final map = {
        'token': 123,
        'url': 456,
        'buyOrder': 789,
        'paymentId': 999,
      };

      final response = WebpayTransactionResponse.fromMap(map);

      expect(response.token, '123');
      expect(response.url, '456');
      expect(response.buyOrder, '789');
      expect(response.paymentId, '999');
    });
  });

  group('WebpayCommitResult', () {
    test('fromMap parsea correctamente un resultado aprobado', () {
      final map = {
        'approved': true,
        'paymentStatus': 'ESCROW',
        'jobStatus': 'PAID_PENDING_EXECUTION',
        'jobId': 'job-123',
        'paymentId': 'payment-456',
        'buyOrder': 'ORDER-789',
        'responseCode': 0,
        'message': 'Transacción aprobada',
      };

      final result = WebpayCommitResult.fromMap(map);

      expect(result.approved, true);
      expect(result.rejected, false);
      expect(result.paymentStatus, 'ESCROW');
      expect(result.jobStatus, 'PAID_PENDING_EXECUTION');
      expect(result.jobId, 'job-123');
      expect(result.paymentId, 'payment-456');
      expect(result.buyOrder, 'ORDER-789');
      expect(result.responseCode, 0);
      expect(result.message, 'Transacción aprobada');
    });

    test('fromMap parsea resultado rechazado', () {
      final map = {
        'approved': false,
        'paymentStatus': 'REJECTED',
        'responseCode': -1,
        'error': 'Tarjeta rechazada',
      };

      final result = WebpayCommitResult.fromMap(map);

      expect(result.approved, false);
      expect(result.rejected, true);
      expect(result.paymentStatus, 'REJECTED');
      expect(result.responseCode, -1);
      expect(result.message, 'Tarjeta rechazada');
    });

    test('fromMap acepta ok=true como aprobado', () {
      final map = {
        'ok': true,
        'paymentStatus': 'ESCROW',
      };

      final result = WebpayCommitResult.fromMap(map);

      expect(result.approved, true);
    });

    test('fromMap usa ESCROW por defecto si approved=true', () {
      final map = {
        'approved': true,
      };

      final result = WebpayCommitResult.fromMap(map);

      expect(result.paymentStatus, 'ESCROW');
    });

    test('fromMap usa REJECTED por defecto si approved=false', () {
      final map = {
        'approved': false,
      };

      final result = WebpayCommitResult.fromMap(map);

      expect(result.paymentStatus, 'REJECTED');
    });

    test('fromMap acepta response_code en snake_case', () {
      final map = {
        'approved': true,
        'paymentStatus': 'ESCROW',
        'response_code': 42,
      };

      final result = WebpayCommitResult.fromMap(map);

      expect(result.responseCode, 42);
    });

    test('fromMap prioriza responseCode sobre response_code', () {
      final map = {
        'approved': true,
        'paymentStatus': 'ESCROW',
        'responseCode': 10,
        'response_code': 20,
      };

      final result = WebpayCommitResult.fromMap(map);

      expect(result.responseCode, 10);
    });

    test('fromMap convierte responseCode string a int', () {
      final map = {
        'approved': true,
        'paymentStatus': 'ESCROW',
        'responseCode': '99',
      };

      final result = WebpayCommitResult.fromMap(map);

      expect(result.responseCode, 99);
    });

    test('fromMap acepta responseCode null', () {
      final map = {
        'approved': true,
        'paymentStatus': 'ESCROW',
      };

      final result = WebpayCommitResult.fromMap(map);

      expect(result.responseCode, null);
    });

    test('fromMap prioriza error sobre message', () {
      final map = {
        'approved': false,
        'paymentStatus': 'REJECTED',
        'error': 'Error primario',
        'message': 'Mensaje secundario',
      };

      final result = WebpayCommitResult.fromMap(map);

      expect(result.message, 'Error primario');
    });

    test('fromMap usa message si no hay error', () {
      final map = {
        'approved': false,
        'paymentStatus': 'REJECTED',
        'message': 'Solo mensaje',
      };

      final result = WebpayCommitResult.fromMap(map);

      expect(result.message, 'Solo mensaje');
    });

    test('fromMap acepta campos opcionales como null', () {
      final map = {
        'approved': true,
        'paymentStatus': 'ESCROW',
      };

      final result = WebpayCommitResult.fromMap(map);

      expect(result.jobStatus, null);
      expect(result.jobId, null);
      expect(result.paymentId, null);
      expect(result.buyOrder, null);
      expect(result.responseCode, null);
      expect(result.message, null);
    });

    test('rejected es el inverso de approved', () {
      final approved = WebpayCommitResult.fromMap({
        'approved': true,
        'paymentStatus': 'ESCROW',
      });

      final rejected = WebpayCommitResult.fromMap({
        'approved': false,
        'paymentStatus': 'REJECTED',
      });

      expect(approved.approved, true);
      expect(approved.rejected, false);
      expect(rejected.approved, false);
      expect(rejected.rejected, true);
    });

    test('fromMap convierte valores a string cuando es necesario', () {
      final map = {
        'approved': true,
        'paymentStatus': 'ESCROW',
        'jobStatus': 123,
        'jobId': 456,
        'paymentId': 789,
        'buyOrder': 999,
      };

      final result = WebpayCommitResult.fromMap(map);

      expect(result.jobStatus, '123');
      expect(result.jobId, '456');
      expect(result.paymentId, '789');
      expect(result.buyOrder, '999');
    });
  });
}
