import nodemailer from "nodemailer";

// Obtiene la URL base de la aplicacion.
// Usamos una funcion para dejar claro el valor por defecto durante desarrollo.
const obtenerAppUrl = () => process.env.APP_URL ?? "http://localhost:3000";

// Crea el transporte SMTP de Nodemailer.
// Lo reutilizamos en todos los emails para mantener una sola configuracion.
const crearTransport = () =>
  nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

// Envia el email de confirmacion despues de crear una cuenta.
const emailRegistro = async (datos) => {
  // Extraemos solo los datos que necesita este correo.
  const { email, nombre, token } = datos;

  // Creamos el transporte SMTP.
  // Los valores vienen desde .env para no escribir credenciales en el codigo.
  const transport = crearTransport();

  // URL que el usuario usara para confirmar su cuenta.
  // APP_URL permite cambiar facilmente entre localhost, staging o produccion.
  const urlConfirmacion = `${obtenerAppUrl()}/auth/confirmar/${token}`;

  // Enviamos el correo.
  await transport.sendMail({
    from: '"BienesRaices" <cuentas@bienesraices.com>',
    to: email,
    subject: "Confirma tu cuenta en BienesRaices",
    text: `Hola ${nombre}, confirma tu cuenta en: ${urlConfirmacion}`,
    html: `
      <p>Hola ${nombre},</p>
      <p>Tu cuenta en BienesRaices ya fue creada.</p>
      <p>Para confirmarla, presiona el siguiente enlace:</p>
      <p>
        <a href="${urlConfirmacion}">Confirmar Cuenta</a>
      </p>
      <p>Si tu no creaste esta cuenta, puedes ignorar este mensaje.</p>
    `,
  });
};

const emailOlvidePassword = async (datos) => {
  // Extraemos solo los datos que necesita este correo.
  const { email, nombre, token } = datos;

  // Creamos el transporte SMTP.
  // Los valores vienen desde .env para no escribir credenciales en el codigo.
  const transport = crearTransport();

  // URL que el usuario usara para crear un password nuevo.
  const urlRestablecer = `${obtenerAppUrl()}/auth/olvide-password/${token}`;

  // Enviamos el correo.
  await transport.sendMail({
    from: '"BienesRaices" <cuentas@bienesraices.com>',
    to: email,
    subject: "Restablece tu Password en BienesRaices",
    text: `Hola ${nombre}, restablece tu password en: ${urlRestablecer}`,
    html: `
      <p>Hola ${nombre}, solicitaste restablecer tu password en Bienes Raices</p>
      <p>Sigue el siguiente enlace para generar un password nuevo:
        <a href="${urlRestablecer}">Restablecer Password</a>
      </p>
      <p>Si tu no solicitaste el cambio de password, puedes ignorar este mensaje.</p>
    `,
  });
};

export { emailRegistro, emailOlvidePassword };
