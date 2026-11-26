import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/utils/validators.dart';

void main() {
  group('Validators', () {
    group('validateEmail', () {
      test('acepta email válido', () {
        expect(Validators.validateEmail('test@example.com'), null);
        expect(Validators.validateEmail('usuario@myworks.cl'), null);
        expect(Validators.validateEmail('nombre.apellido@empresa.com'), null);
      });

      test('rechaza email vacío', () {
        expect(Validators.validateEmail(''), 'El email es requerido');
      });

      test('rechaza email null', () {
        expect(Validators.validateEmail(null), 'El email es requerido');
      });

      test('rechaza email sin @', () {
        expect(Validators.validateEmail('invalido.com'), 'Email inválido');
      });

      test('rechaza email sin dominio', () {
        expect(Validators.validateEmail('test@'), 'Email inválido');
      });

      test('rechaza email sin usuario', () {
        expect(Validators.validateEmail('@example.com'), 'Email inválido');
      });
    });

    group('validateName', () {
      test('acepta nombre válido', () {
        expect(Validators.validateName('Juan'), null);
        expect(Validators.validateName('María Elena'), null);
        expect(Validators.validateName('José Miguel González'), null);
      });

      test('rechaza nombre vacío', () {
        expect(Validators.validateName(''), 'El nombre es requerido');
      });

      test('rechaza nombre null', () {
        expect(Validators.validateName(null), 'El nombre es requerido');
      });

      test('rechaza nombre de un solo carácter', () {
        expect(
          Validators.validateName('A'),
          'El nombre debe tener al menos 2 caracteres',
        );
      });

      test('acepta nombre de exactamente 2 caracteres', () {
        expect(Validators.validateName('Lu'), null);
      });
    });

    group('validatePassword', () {
      test('acepta contraseña válida', () {
        expect(Validators.validatePassword('123456'), null);
        expect(Validators.validatePassword('password'), null);
        expect(Validators.validatePassword('MiClave2024'), null);
      });

      test('rechaza contraseña vacía', () {
        expect(Validators.validatePassword(''), 'La contraseña es requerida');
      });

      test('rechaza contraseña null', () {
        expect(Validators.validatePassword(null), 'La contraseña es requerida');
      });

      test('rechaza contraseña menor a 6 caracteres', () {
        expect(
          Validators.validatePassword('12345'),
          'La contraseña debe tener al menos 6 caracteres',
        );
      });

      test('acepta contraseña de exactamente 6 caracteres', () {
        expect(Validators.validatePassword('123456'), null);
      });
    });

    group('validateSecurePassword', () {
      test('acepta contraseña segura', () {
        expect(Validators.validateSecurePassword('Password123'), null);
        expect(Validators.validateSecurePassword('MiClave2024'), null);
        expect(Validators.validateSecurePassword('Contraseña1'), null);
      });

      test('rechaza contraseña vacía', () {
        expect(
          Validators.validateSecurePassword(''),
          'La contraseña es requerida',
        );
      });

      test('rechaza contraseña null', () {
        expect(
          Validators.validateSecurePassword(null),
          'La contraseña es requerida',
        );
      });

      test('rechaza contraseña menor a 8 caracteres', () {
        expect(
          Validators.validateSecurePassword('Pass1'),
          'La contraseña debe tener al menos 8 caracteres',
        );
      });

      test('rechaza contraseña sin letras', () {
        expect(
          Validators.validateSecurePassword('12345678'),
          'Incluye al menos una letra',
        );
      });

      test('rechaza contraseña sin números', () {
        expect(
          Validators.validateSecurePassword('Password'),
          'Incluye al menos un número',
        );
      });

      test('acepta letras con tilde', () {
        expect(Validators.validateSecurePassword('Contraseña1'), null);
        expect(Validators.validateSecurePassword('Móvil123'), null);
      });

      test('acepta ñ en contraseña', () {
        expect(Validators.validateSecurePassword('Niño1234'), null);
      });
    });

    group('passwordStrength', () {
      test('contraseña vacía es débil', () {
        expect(Validators.passwordStrength(''), PasswordStrength.weak);
      });

      test('contraseña corta es débil', () {
        expect(Validators.passwordStrength('123'), PasswordStrength.weak);
        expect(Validators.passwordStrength('abc'), PasswordStrength.weak);
      });

      test('contraseña solo números es débil/media', () {
        expect(Validators.passwordStrength('12345'), PasswordStrength.weak);
        expect(Validators.passwordStrength('12345678'), PasswordStrength.medium);
      });

      test('contraseña con letras minúsculas y números es media', () {
        expect(Validators.passwordStrength('password1'), PasswordStrength.medium);
        expect(Validators.passwordStrength('Password123'), PasswordStrength.medium);
      });

      test('contraseña larga con mayúsculas, minúsculas y números es fuerte', () {
        expect(Validators.passwordStrength('MiPassword123'), PasswordStrength.strong);
      });

      test('contraseña larga y compleja es fuerte', () {
        expect(
          Validators.passwordStrength('MiContraseña2024!'),
          PasswordStrength.strong,
        );
      });

      test('contraseña con caracteres especiales aumenta fortaleza', () {
        expect(Validators.passwordStrength('Pass@123'), PasswordStrength.strong);
        expect(Validators.passwordStrength('Clave#2024'), PasswordStrength.strong);
      });

      test('contraseña de 12+ caracteres es más fuerte', () {
        expect(
          Validators.passwordStrength('ContraseñaLarga123'),
          PasswordStrength.strong,
        );
      });
    });

    group('validateRequired', () {
      test('acepta valor válido', () {
        expect(Validators.validateRequired('valor', 'Campo'), null);
      });

      test('rechaza valor vacío', () {
        expect(
          Validators.validateRequired('', 'Campo'),
          'Campo es requerido',
        );
      });

      test('rechaza valor null', () {
        expect(
          Validators.validateRequired(null, 'Campo'),
          'Campo es requerido',
        );
      });

      test('personaliza mensaje con nombre del campo', () {
        expect(
          Validators.validateRequired(null, 'Nombre completo'),
          'Nombre completo es requerido',
        );
        expect(
          Validators.validateRequired('', 'Teléfono'),
          'Teléfono es requerido',
        );
      });
    });

    group('validateAddress', () {
      test('acepta dirección válida', () {
        expect(
          Validators.validateAddress('Calle Principal 123, Santiago'),
          null,
        );
        expect(
          Validators.validateAddress('Av. Libertador Bernardo O\'Higgins 1234'),
          null,
        );
      });

      test('rechaza dirección vacía', () {
        expect(
          Validators.validateAddress(''),
          'La dirección es requerida',
        );
      });

      test('rechaza dirección null', () {
        expect(
          Validators.validateAddress(null),
          'La dirección es requerida',
        );
      });

      test('rechaza dirección menor a 10 caracteres', () {
        expect(
          Validators.validateAddress('Calle 1'),
          'La dirección debe tener al menos 10 caracteres',
        );
      });

      test('acepta dirección de exactamente 10 caracteres', () {
        expect(Validators.validateAddress('Calle 1234'), null);
      });
    });

    group('validateDescription', () {
      test('acepta descripción válida', () {
        expect(
          Validators.validateDescription('Necesito reparar una fuga de agua'),
          null,
        );
      });

      test('rechaza descripción vacía', () {
        expect(
          Validators.validateDescription(''),
          'La descripción es requerida',
        );
      });

      test('rechaza descripción null', () {
        expect(
          Validators.validateDescription(null),
          'La descripción es requerida',
        );
      });

      test('rechaza descripción menor a 10 caracteres', () {
        expect(
          Validators.validateDescription('Fuga'),
          'La descripción debe tener al menos 10 caracteres',
        );
      });

      test('acepta descripción de exactamente 10 caracteres', () {
        expect(Validators.validateDescription('Reparación'), null);
      });
    });
  });
}
