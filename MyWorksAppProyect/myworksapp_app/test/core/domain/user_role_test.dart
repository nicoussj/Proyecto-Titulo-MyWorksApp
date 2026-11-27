import 'package:flutter_test/flutter_test.dart';
import 'package:myworksapp/core/domain/user_role.dart';

void main() {
  group('UserRole', () {
    group('dbValue', () {
      test('cliente mapea a "usuario"', () {
        expect(UserRole.cliente.dbValue, 'usuario');
      });

      test('especialista mapea a "trabajador"', () {
        expect(UserRole.especialista.dbValue, 'trabajador');
      });

      test('administrador mapea a "administrador"', () {
        expect(UserRole.administrador.dbValue, 'administrador');
      });
    });

    group('label', () {
      test('cliente muestra "Cliente"', () {
        expect(UserRole.cliente.label, 'Cliente');
      });

      test('especialista muestra "Especialista"', () {
        expect(UserRole.especialista.label, 'Especialista');
      });

      test('administrador muestra "Administrador"', () {
        expect(UserRole.administrador.label, 'Administrador');
      });
    });

    group('description', () {
      test('cliente muestra descripción para buscar servicios', () {
        expect(UserRole.cliente.description, 'Busco servicios profesionales');
      });

      test('especialista muestra descripción para ofrecer servicios', () {
        expect(
          UserRole.especialista.description,
          'Ofrezco servicios profesionales',
        );
      });

      test('administrador muestra descripción de gestión', () {
        expect(
          UserRole.administrador.description,
          'Gestión y supervisión de la plataforma',
        );
      });
    });

    group('getters booleanos', () {
      test('isCliente es true solo para cliente', () {
        expect(UserRole.cliente.isCliente, true);
        expect(UserRole.especialista.isCliente, false);
        expect(UserRole.administrador.isCliente, false);
      });

      test('isEspecialista es true solo para especialista', () {
        expect(UserRole.cliente.isEspecialista, false);
        expect(UserRole.especialista.isEspecialista, true);
        expect(UserRole.administrador.isEspecialista, false);
      });

      test('isAdministrador es true solo para administrador', () {
        expect(UserRole.cliente.isAdministrador, false);
        expect(UserRole.especialista.isAdministrador, false);
        expect(UserRole.administrador.isAdministrador, true);
      });
    });

    group('publicRoles', () {
      test('contiene solo cliente y especialista', () {
        expect(UserRole.publicRoles, hasLength(2));
        expect(UserRole.publicRoles, contains(UserRole.cliente));
        expect(UserRole.publicRoles, contains(UserRole.especialista));
        expect(UserRole.publicRoles, isNot(contains(UserRole.administrador)));
      });
    });

    group('fromDb', () {
      test('parsea "trabajador" como especialista', () {
        expect(UserRole.fromDb('trabajador'), UserRole.especialista);
      });

      test('parsea "worker" como especialista', () {
        expect(UserRole.fromDb('worker'), UserRole.especialista);
      });

      test('parsea "especialista" como especialista', () {
        expect(UserRole.fromDb('especialista'), UserRole.especialista);
      });

      test('parsea "specialist" como especialista', () {
        expect(UserRole.fromDb('specialist'), UserRole.especialista);
      });

      test('parsea "administrador" como administrador', () {
        expect(UserRole.fromDb('administrador'), UserRole.administrador);
      });

      test('parsea "admin" como administrador', () {
        expect(UserRole.fromDb('admin'), UserRole.administrador);
      });

      test('parsea "administrator" como administrador', () {
        expect(UserRole.fromDb('administrator'), UserRole.administrador);
      });

      test('parsea "usuario" como cliente', () {
        expect(UserRole.fromDb('usuario'), UserRole.cliente);
      });

      test('parsea "user" como cliente', () {
        expect(UserRole.fromDb('user'), UserRole.cliente);
      });

      test('parsea "cliente" como cliente', () {
        expect(UserRole.fromDb('cliente'), UserRole.cliente);
      });

      test('parsea "client" como cliente', () {
        expect(UserRole.fromDb('client'), UserRole.cliente);
      });

      test('es case-insensitive', () {
        expect(UserRole.fromDb('TRABAJADOR'), UserRole.especialista);
        expect(UserRole.fromDb('Admin'), UserRole.administrador);
        expect(UserRole.fromDb('USUARIO'), UserRole.cliente);
      });

      test('ignora espacios en blanco', () {
        expect(UserRole.fromDb('  trabajador  '), UserRole.especialista);
        expect(UserRole.fromDb(' admin '), UserRole.administrador);
        expect(UserRole.fromDb('  usuario  '), UserRole.cliente);
      });

      test('trata null como cliente', () {
        expect(UserRole.fromDb(null), UserRole.cliente);
      });

      test('trata string vacío como cliente', () {
        expect(UserRole.fromDb(''), UserRole.cliente);
      });

      test('trata valor desconocido como cliente', () {
        expect(UserRole.fromDb('desconocido'), UserRole.cliente);
        expect(UserRole.fromDb('xyz'), UserRole.cliente);
        expect(UserRole.fromDb('123'), UserRole.cliente);
      });
    });

    group('sanitizeForRegistration', () {
      test('mantiene especialista', () {
        expect(
          UserRole.sanitizeForRegistration(UserRole.especialista),
          UserRole.especialista,
        );
      });

      test('mantiene cliente', () {
        expect(
          UserRole.sanitizeForRegistration(UserRole.cliente),
          UserRole.cliente,
        );
      });

      test('convierte administrador a cliente', () {
        expect(
          UserRole.sanitizeForRegistration(UserRole.administrador),
          UserRole.cliente,
        );
      });

      test('trata null como cliente', () {
        expect(
          UserRole.sanitizeForRegistration(null),
          UserRole.cliente,
        );
      });
    });

    group('integración', () {
      test('roundtrip cliente: dbValue -> fromDb', () {
        const role = UserRole.cliente;
        final dbValue = role.dbValue;
        final parsed = UserRole.fromDb(dbValue);
        expect(parsed, role);
      });

      test('roundtrip especialista: dbValue -> fromDb', () {
        const role = UserRole.especialista;
        final dbValue = role.dbValue;
        final parsed = UserRole.fromDb(dbValue);
        expect(parsed, role);
      });

      test('roundtrip administrador: dbValue -> fromDb', () {
        const role = UserRole.administrador;
        final dbValue = role.dbValue;
        final parsed = UserRole.fromDb(dbValue);
        expect(parsed, role);
      });

      test('solo roles públicos pueden registrarse sin sanitización', () {
        for (final role in UserRole.publicRoles) {
          expect(UserRole.sanitizeForRegistration(role), role);
        }
      });
    });
  });
}
