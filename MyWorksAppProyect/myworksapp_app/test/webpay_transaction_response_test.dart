import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/domain/webpay_transaction.dart';

void main() {
  test('WebpayTransactionResponse exige token, url y buyOrder', () {
    final parsed = WebpayTransactionResponse.fromMap({
      'token': 'tok_1',
      'url': 'https://webpay3gint.transbank.cl/webpayserver/initTransaction',
      'buyOrder': 'MWA123',
      'paymentId': 'pay-1',
    });

    expect(parsed.token, 'tok_1');
    expect(parsed.url, contains('transbank'));
    expect(parsed.buyOrder, 'MWA123');
    expect(parsed.paymentId, 'pay-1');
  });

  test('WebpayCommitResult marca escrow aprobado', () {
    final parsed = WebpayCommitResult.fromMap({
      'approved': true,
      'paymentStatus': 'ESCROW',
      'jobStatus': 'PAID_PENDING_EXECUTION',
      'responseCode': 0,
      'jobId': 'job-1',
    });

    expect(parsed.approved, isTrue);
    expect(parsed.rejected, isFalse);
    expect(parsed.paymentStatus, 'ESCROW');
    expect(parsed.jobStatus, 'PAID_PENDING_EXECUTION');
    expect(parsed.responseCode, 0);
  });

  test('WebpayTransactionResponse rechaza payload incompleto', () {
    expect(
      () => WebpayTransactionResponse.fromMap({'token': 'solo'}),
      throwsFormatException,
    );
  });
}
