import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/config/supabase_config.dart';

void main() {
  test('validateForCurrentBuild no tira con defaults de demo', () {
    expect(SupabaseConfig.url, isNotEmpty);
    expect(SupabaseConfig.publishableKey, isNotEmpty);
    expect(() => SupabaseConfig.validateForCurrentBuild(), returnsNormally);
  });
}
