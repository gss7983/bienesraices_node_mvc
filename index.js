import express from "express";
import csrf from "csurf";
import cookieParser from "cookie-parser";
import usuarioRoutes from "./routes/usuarioRoutes.js";
import propiedadesRoutes from "./routes/propiedadesRoutes.js";
import appRoutes from "./routes/appRoutes.js";
import apiRoutes from "./routes/apiRoutes.js";
import db from "./config/db.js";

// Creamos una instancia de Express.
// Esta constante "app" representa nuestro servidor.
const app = express();

// Funcion para comprobar la conexion a la base de datos.
// Si la conexion falla, detenemos la app porque las rutas dependeran de MySQL.
const conectarDB = async () => {
  try {
    await db.authenticate();

    // Sincroniza los modelos con la base de datos.
    // Si la tabla usuarios no existe, Sequelize la creara.
    await db.sync();

    console.log("Conexion correcta a la base de datos");
  } catch (error) {
    console.error("No se pudo conectar a la base de datos");
    console.error(error);
    process.exit(1);
  }
};

// Habilitamos Pug como motor de plantillas.
// Con esto Express podra renderizar archivos con extension .pug.
app.set("view engine", "pug");

// Definimos la carpeta donde estaran nuestras vistas.
// Por defecto Express busca una carpeta llamada "views", pero lo dejamos
// explicito para que sea mas claro durante el aprendizaje.
app.set("views", "./views");

// Habilitamos la lectura de datos enviados desde formularios HTML.
// Esto permite leer campos enviados con method="POST" usando req.body.
app.use(express.urlencoded({ extended: true }));

// Habilitamos la lectura de datos en formato JSON.
// Sera util si mas adelante recibimos peticiones desde fetch, APIs o frontend JS.
app.use(express.json());

// Habilitamos cookie-parser.
// csurf necesita leer y escribir una cookie para guardar el secreto del token.
app.use(cookieParser());

// Carpeta publica.
// Todo lo que este dentro de public se podra cargar desde el navegador.
// Ejemplo: public/css/app.css se visita como /css/app.css.
app.use(express.static("public"));

// Habilitamos proteccion CSRF.
// Esto protege formularios POST evitando envios falsificados desde otros sitios.
// Usamos cookie: true para guardar el secreto en una cookie.
app.use(csrf({ cookie: true }));

// Las rutas publicas se registran primero para que "/" muestre el inicio.
app.use("/", appRoutes);

// API publica utilizada por el JavaScript del navegador.
// Se mantiene bajo /api para separar las respuestas JSON de las vistas Pug.
app.use("/api", apiRoutes);

// Las rutas de autenticacion se agrupan bajo "/auth".
app.use("/auth", usuarioRoutes);

// Las rutas de propiedades incluyen el panel privado y el detalle publico.
app.use("/", propiedadesRoutes);

// Manejador de errores CSRF.
// Si el token falta, expiro o fue modificado, csurf lanzara EBADCSRFTOKEN.
app.use((error, req, res, next) => {
  if (error.code !== "EBADCSRFTOKEN") {
    return next(error);
  }

  return res.status(403).render("templates/mensaje", {
    pagina: "Accion no valida",
    mensaje:
      "El formulario expiro o no es valido. Vuelve a intentarlo desde la pagina original.",
    enlace: "/auth/login",
    textoEnlace: "Ir a Iniciar Sesion",
  });
});

// Definimos el puerto donde se ejecutara el servidor.
// Primero intentamos leerlo desde .env y si no existe usamos 3000.
const port = Number(process.env.APP_PORT ?? 3000);

// Primero comprobamos la base de datos.
// Despues iniciamos el servidor y lo dejamos escuchando peticiones.
await conectarDB();

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
