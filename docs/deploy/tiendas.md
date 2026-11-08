# Publicar APUNTOR en las tiendas

Pasos que debe hacer el dueño. Nada de esto se automatiza desde el repositorio.

## 1. Cuentas (una sola vez)

1. Apple Developer Program (99 USD al año): https://developer.apple.com/programs/. La aprobación puede tardar de 1 a 2 días.
2. Google Play Console (25 USD, pago único): https://play.google.com/console. Pide verificar identidad.
3. Cuenta de Expo (gratis): https://expo.dev.

## 2. Preparar el equipo

```
cd app
npm install
npx expo install expo-image-picker
npm install -g eas-cli
eas login
eas init
```

`eas init` escribe el `projectId` en `app.json`. Súbelo al repositorio.

## 3. Variables de entorno

Define la URL de la API de producción como variable de EAS (`eas env:create`) para cada perfil. No la pongas en el repositorio.

## 4. Compilar

- Prueba en el teléfono (APK, Android): `eas build --profile preview --platform android`. Descarga el APK desde el enlace que entrega EAS.
- Cliente de desarrollo: `eas build --profile development --platform all`.
- Tiendas: `eas build --profile production --platform all`. En iOS EAS pide iniciar sesión en Apple y crea los certificados.

## 5. Enviar a las tiendas

1. Crea la ficha de la app en App Store Connect (identificador `pe.apuntor.app`) y en Google Play Console (paquete `pe.apuntor.app`). La primera subida a Google Play debe hacerse a mano con el `.aab`.
2. `eas submit --platform ios --profile production`
3. `eas submit --platform android --profile production` (necesita la clave de cuenta de servicio de Google).
4. Completa en cada tienda: capturas, descripción, política de privacidad, clasificación de edad y el formulario de seguridad de datos.
5. Usa pruebas internas (TestFlight y pista interna de Play) antes de publicar.

## 6. Textos de permisos

La cámara y las fotos se piden con textos en español definidos en `app/app.json`. Las tiendas revisan que coincidan con el uso real.
