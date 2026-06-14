import jwt from "jsonwebtoken";
import dotenv from "dotenv";

// Cargamos .env para que JWT_SECRET este disponible aunque este helper
// se importe antes que otros archivos de configuracion.
dotenv.config({ path: ".env" });

// Genera un JSON Web Token para el usuario autenticado.
// Guardamos solo datos minimos para identificarlo en rutas protegidas.
const generarJWT = (datos) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("La variable de entorno JWT_SECRET es obligatoria");
  }

  return jwt.sign(
    { id: datos.id, nombre: datos.nombre },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    },
  );
};

// Genera un identificador unico para usarlo como token.
// El curso lo llama generarId, asi que mantenemos ese nombre.
//
// Math.random() aporta una parte aleatoria.
// Date.now() agrega una parte basada en la fecha/hora actual.
// Juntos reducen la posibilidad de repetir el mismo token.
const generarId = () =>
  Math.random().toString(32).substring(2) + Date.now().toString(32);

export { generarId, generarJWT };
