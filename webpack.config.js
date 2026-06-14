import path from "node:path";

export default {
  mode: "development",
  devtool: "source-map",
  entry: {
    mapa: "./src/js/mapa.js",
    agregarImagen: "./src/js/agregarImagen.js",
    mostrarMapa: "./src/js/mostrarMapa.js",
    // Mapa amplio de la pagina publica de inicio.
    mapaInicio: "./src/js/mapaInicio.js",
    admin: "./src/js/admin.js",
    cambiarEstado: "./src/js/cambiarEstado.js",
  },
  output: {
    filename: "[name].js",
    path: path.resolve("public/js"),
  },
};
