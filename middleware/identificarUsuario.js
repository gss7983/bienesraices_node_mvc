import jwt from "jsonwebtoken";
import Usuario from "../models/Usuario.js";

// Identifica de forma opcional al visitante de una ruta publica.
// A diferencia de protegerRuta, este middleware nunca obliga a iniciar sesion:
// la propiedad debe seguir visible aunque no exista una cookie valida.
const identificarUsuario = async (req, res, next) => {
  const token = req.cookies?._token;

  if (!token) {
    req.usuario = null;
    return next();
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("La variable de entorno JWT_SECRET es obligatoria");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // El scope excluye password, tokens y otros campos sensibles.
    const usuario = await Usuario.scope("eliminarPassword").findByPk(
      decoded.id,
    );

    if (!usuario) {
      req.usuario = null;
      res.clearCookie("_token");
      return next();
    }

    req.usuario = usuario;
    return next();
  } catch (error) {
    // Una cookie vencida o modificada no debe bloquear una pagina publica.
    req.usuario = null;
    res.clearCookie("_token");
    return next();
  }
};

export default identificarUsuario;
