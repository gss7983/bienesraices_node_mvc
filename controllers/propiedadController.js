import { check, validationResult } from "express-validator";
import { unlink } from "node:fs/promises";
import path from "node:path";
import {
  Categoria,
  Mensaje,
  Precio,
  Propiedad,
  Usuario,
} from "../models/index.js";
import { esVendedor } from "../helpers/index.js";

const PROPIEDADES_POR_PAGINA = 10;

const normalizarCoordenada = (valor) => Number.parseFloat(valor);

const validarRangoCoordenada = (valor, minimo, maximo) => {
  const coordenada = normalizarCoordenada(valor);

  return (
    Number.isFinite(coordenada) && coordenada >= minimo && coordenada <= maximo
  );
};

// Carga todos los datos publicos necesarios para mostrar una propiedad.
const obtenerPropiedadPublicada = (id) =>
  Propiedad.findOne({
    where: {
      id,
      publicado: true,
    },
    include: [
      {
        model: Categoria,
        as: "categoria",
        attributes: ["id", "nombre"],
      },
      {
        model: Precio,
        as: "precio",
        attributes: ["id", "precio"],
      },
      {
        model: Usuario,
        as: "usuario",
        attributes: ["id", "nombre"],
      },
    ],
  });

// Renderiza el formulario compartido por las acciones crear y editar.
// Centralizarlo evita duplicar categorias, precios, CSRF y mensajes de error.
const renderFormulario = async (req, res, opciones = {}) => {
  const {
    errores = [],
    propiedad = {},
    pagina = "Crear Propiedad",
    action = "/propiedades/crear",
    textoBoton = "Crear Propiedad",
    esEdicion = false,
  } = opciones;

  // Carga los datos necesarios para llenar los selects del formulario.
  // Las categorias se ordenan alfabeticamente para mejorar la experiencia.
  const [categorias, precios] = await Promise.all([
    Categoria.findAll({ order: [["nombre", "ASC"]] }),
    Precio.findAll({ order: [["id", "ASC"]] }),
  ]);

  return res.render("propiedades/crear", {
    pagina,
    usuario: req.usuario,
    csrfToken: req.csrfToken(),
    categorias,
    precios,
    errores,
    propiedad,
    action,
    textoBoton,
    esEdicion,
  });
};

// Ejecuta las mismas validaciones al crear y al editar una propiedad.
const validarFormulario = async (req) => {
  await check("titulo")
    .trim()
    .notEmpty()
    .withMessage("El titulo del anuncio es obligatorio")
    .bail()
    .isLength({ max: 100 })
    .withMessage("El titulo no puede exceder 100 caracteres")
    .run(req);

  await check("descripcion")
    .trim()
    .notEmpty()
    .withMessage("La descripcion es obligatoria")
    .bail()
    .isLength({ max: 500 })
    .withMessage("La descripcion no puede exceder 500 caracteres")
    .run(req);

  await check("categoria")
    .notEmpty()
    .withMessage("Selecciona una categoria")
    .bail()
    .isInt({ min: 1 })
    .withMessage("La categoria no es valida")
    .bail()
    .custom(async (value) => {
      const categoriaExiste = await Categoria.findByPk(value);

      if (!categoriaExiste) {
        throw new Error("La categoria seleccionada no existe");
      }

      return true;
    })
    .run(req);

  await check("precio")
    .notEmpty()
    .withMessage("Selecciona un precio")
    .bail()
    .isInt({ min: 1 })
    .withMessage("El precio no es valido")
    .bail()
    .custom(async (value) => {
      const precioExiste = await Precio.findByPk(value);

      if (!precioExiste) {
        throw new Error("El precio seleccionado no existe");
      }

      return true;
    })
    .run(req);

  await check("habitaciones")
    .notEmpty()
    .withMessage("Selecciona el numero de habitaciones")
    .bail()
    .isInt({ min: 0, max: 5 })
    .withMessage("El numero de habitaciones no es valido")
    .run(req);

  await check("estacionamiento")
    .notEmpty()
    .withMessage("Selecciona el numero de estacionamientos")
    .bail()
    .isInt({ min: 0, max: 5 })
    .withMessage("El numero de estacionamientos no es valido")
    .run(req);

  await check("wc")
    .notEmpty()
    .withMessage("Selecciona el numero de banos")
    .bail()
    .isInt({ min: 0, max: 5 })
    .withMessage("El numero de banos no es valido")
    .run(req);

  // La ubicacion es obligatoria: el mapa llena calle, lat y lng.
  await check("calle")
    .trim()
    .custom((value, { req: request }) => {
      const direccion = value?.trim();
      const { lat, lng } = request.body;

      if (!direccion || !lat || !lng) {
        throw new Error("Selecciona la ubicacion de la propiedad en el mapa");
      }

      if (direccion.length < 5) {
        throw new Error("La direccion de la propiedad no es valida");
      }

      if (direccion.length > 255) {
        throw new Error("La direccion no puede exceder 255 caracteres");
      }

      if (!validarRangoCoordenada(lat, -90, 90)) {
        throw new Error("La latitud no es valida");
      }

      if (!validarRangoCoordenada(lng, -180, 180)) {
        throw new Error("La longitud no es valida");
      }

      return true;
    })
    .run(req);
};

// Convierte los valores del formulario al formato esperado por Sequelize.
const datosPropiedad = (body) => ({
  titulo: body.titulo.trim(),
  descripcion: body.descripcion.trim(),
  habitaciones: Number(body.habitaciones),
  estacionamiento: Number(body.estacionamiento),
  wc: Number(body.wc),
  calle: body.calle.trim(),
  lat: normalizarCoordenada(body.lat),
  lng: normalizarCoordenada(body.lng),
  precioId: Number(body.precio),
  categoriaId: Number(body.categoria),
});

const datosParaFormulario = (body) => ({
  titulo: body.titulo,
  descripcion: body.descripcion,
  categoria: body.categoria,
  precio: body.precio,
  habitaciones: body.habitaciones,
  estacionamiento: body.estacionamiento,
  wc: body.wc,
  calle: body.calle,
  lat: body.lat,
  lng: body.lng,
});

// Genera un paginador compacto con la primera, ultima y paginas cercanas
// a la actual. Los puntos suspensivos representan rangos omitidos.
const crearRangoPaginas = (paginaActual, totalPaginas) => {
  const paginasNecesarias = [
    1,
    paginaActual - 1,
    paginaActual,
    paginaActual + 1,
    totalPaginas,
  ]
    .filter((pagina) => pagina >= 1 && pagina <= totalPaginas)
    .filter((pagina, indice, paginas) => paginas.indexOf(pagina) === indice)
    .sort((a, b) => a - b);

  return paginasNecesarias.reduce((resultado, pagina, indice) => {
    const paginaAnterior = paginasNecesarias[indice - 1];

    if (paginaAnterior && pagina - paginaAnterior > 1) {
      resultado.push("...");
    }

    resultado.push(pagina);
    return resultado;
  }, []);
};

const admin = async (req, res) => {
  try {
    // El id proviene del usuario autenticado por el middleware protegerRuta.
    const { id } = req.usuario;
    const filtro = req.query.estado === "pendientes" ? "pendientes" : "todas";
    const paginaSolicitada = req.query.pagina;
    const paginaValida = /^[1-9]\d*$/.test(paginaSolicitada || "1");

    // Valores como pagina=0, negativos, decimales o texto regresan al inicio.
    if (!paginaValida) {
      const estado = filtro === "pendientes" ? "&estado=pendientes" : "";
      return res.redirect(
        `/mis-propiedades?pagina=1${estado}#listado-propiedades`,
      );
    }

    const paginaActual = Number.parseInt(paginaSolicitada || "1", 10);
    const offset = (paginaActual - 1) * PROPIEDADES_POR_PAGINA;
    const whereListado =
      filtro === "pendientes"
        ? { usuarioId: id, imagen: "" }
        : { usuarioId: id };

    // El listado se pagina desde MySQL. Los conteos adicionales alimentan
    // los indicadores generales sin depender de la pagina visible.
    const [
      resultado,
      publicadas,
      pendientes,
      total,
      mensajesRecibidos,
      mensajesLeidos,
      mensajesPendientes,
    ] = await Promise.all([
      Propiedad.findAndCountAll({
        limit: PROPIEDADES_POR_PAGINA,
        offset,
        where: whereListado,
        include: [
          {
            model: Categoria,
            as: "categoria",
            attributes: ["id", "nombre"],
          },
          {
            model: Precio,
            as: "precio",
            attributes: ["id", "precio"],
          },
          {
            model: Mensaje,
            as: "mensajes",
            // El panel necesita el id y estado para calcular los indicadores
            // visibles de cada propiedad sin recuperar el contenido.
            // El contenido se consultara al abrir la pagina de mensajes.
            attributes: ["id", "leido"],
          },
        ],
        order: [["createdAt", "DESC"]],
        distinct: true,
      }),
      Propiedad.count({ where: { usuarioId: id, publicado: true } }),
      Propiedad.count({ where: { usuarioId: id, imagen: "" } }),
      Propiedad.count({ where: { usuarioId: id } }),
      Mensaje.count({
        include: [
          {
            model: Propiedad,
            as: "propiedad",
            attributes: [],
            where: { usuarioId: id },
            required: true,
          },
        ],
      }),
      Mensaje.count({
        where: { leido: true },
        include: [
          {
            model: Propiedad,
            as: "propiedad",
            attributes: [],
            where: { usuarioId: id },
            required: true,
          },
        ],
      }),
      Mensaje.count({
        where: { leido: false },
        include: [
          {
            model: Propiedad,
            as: "propiedad",
            attributes: [],
            where: { usuarioId: id },
            required: true,
          },
        ],
      }),
    ]);

    const totalResultados = resultado.count;
    const paginas = Math.ceil(totalResultados / PROPIEDADES_POR_PAGINA);

    // Si una pagina deja de existir despues de eliminar registros, redirigimos
    // a la ultima pagina valida para evitar mostrar un listado vacio.
    if (paginaActual > 1 && (totalResultados === 0 || paginaActual > paginas)) {
      const ultimaPagina = Math.max(paginas, 1);
      const estado = filtro === "pendientes" ? "&estado=pendientes" : "";
      return res.redirect(
        `/mis-propiedades?pagina=${ultimaPagina}${estado}#listado-propiedades`,
      );
    }

    const mensajes = {
      editada: "La propiedad se actualizo correctamente.",
      estado: "El estado de la propiedad se actualizo correctamente.",
      eliminada: "La propiedad se elimino correctamente.",
      "sin-imagen": "Agrega una imagen antes de publicar la propiedad.",
    };

    return res.render("propiedades/admin", {
      pagina: "Mis Propiedades",
      propiedades: resultado.rows,
      resumen: {
        publicadas,
        pendientes,
        total,
        mensajes: {
          recibidos: mensajesRecibidos,
          leidos: mensajesLeidos,
          pendientes: mensajesPendientes,
        },
      },
      filtro,
      mensaje: mensajes[req.query.resultado],
      usuario: req.usuario,
      csrfToken: req.csrfToken(),
      paginacion: {
        paginaActual,
        paginas,
        totalResultados,
        rango: crearRangoPaginas(paginaActual, paginas),
      },
    });
  } catch (error) {
    console.error("No fue posible obtener las propiedades:", error);

    // La vista permanece disponible y muestra un mensaje comprensible.
    return res.status(500).render("propiedades/admin", {
      pagina: "Mis Propiedades",
      propiedades: [],
      resumen: {
        publicadas: 0,
        pendientes: 0,
        total: 0,
        mensajes: {
          recibidos: 0,
          leidos: 0,
          pendientes: 0,
        },
      },
      filtro: "todas",
      paginacion: {
        paginaActual: 1,
        paginas: 0,
        totalResultados: 0,
        rango: [],
      },
      errores: [
        {
          msg: "No fue posible cargar tus propiedades. Intenta nuevamente.",
        },
      ],
      usuario: req.usuario,
      csrfToken: req.csrfToken(),
    });
  }
};

const crear = async (req, res) => {
  // Renderiza el formulario inicial para publicar una propiedad.
  return renderFormulario(req, res);
};

const guardar = async (req, res) => {
  await validarFormulario(req);

  const resultado = validationResult(req);

  if (!resultado.isEmpty()) {
    return renderFormulario(req, res, {
      errores: resultado.array(),
      propiedad: datosParaFormulario(req.body),
    });
  }

  try {
    // Creamos la propiedad con las llaves foraneas recibidas del formulario
    // y el id del usuario autenticado que publica el anuncio.
    const propiedadGuardada = await Propiedad.create({
      ...datosPropiedad(req.body),
      imagen: "",
      usuarioId: req.usuario.id,
    });

    const { id } = propiedadGuardada;
    return res.redirect(`/propiedades/agregar-imagen/${id}`);
  } catch (error) {
    console.error("No fue posible guardar la propiedad:", error);

    // Sequelize puede devolver mensajes especificos que ayudan a corregir
    // datos demasiado largos o relaciones que ya no existen.
    const mensaje =
      error.name === "SequelizeValidationError"
        ? error.errors[0]?.message
        : error.name === "SequelizeForeignKeyConstraintError"
          ? "La categoria, el precio o el usuario seleccionado ya no existe"
          : "No fue posible guardar la propiedad";

    return renderFormulario(req, res, {
      errores: [{ msg: mensaje }],
      propiedad: datosParaFormulario(req.body),
    });
  }
};

const editar = async (req, res) => {
  const propiedad = await Propiedad.findOne({
    where: {
      id: req.params.id,
      usuarioId: req.usuario.id,
    },
  });

  if (!propiedad) {
    return res.redirect("/mis-propiedades");
  }

  return renderFormulario(req, res, {
    pagina: `Editar: ${propiedad.titulo}`,
    action: `/propiedades/editar/${propiedad.id}`,
    textoBoton: "Guardar cambios",
    esEdicion: true,
    propiedad: {
      ...propiedad.get({ plain: true }),
      categoria: propiedad.categoriaId,
      precio: propiedad.precioId,
    },
  });
};

const guardarCambios = async (req, res) => {
  const propiedad = await Propiedad.findOne({
    where: {
      id: req.params.id,
      usuarioId: req.usuario.id,
    },
  });

  if (!propiedad) {
    return res.redirect("/mis-propiedades");
  }

  await validarFormulario(req);
  const resultado = validationResult(req);

  if (!resultado.isEmpty()) {
    return renderFormulario(req, res, {
      pagina: `Editar: ${propiedad.titulo}`,
      action: `/propiedades/editar/${propiedad.id}`,
      textoBoton: "Guardar cambios",
      esEdicion: true,
      errores: resultado.array(),
      propiedad: datosParaFormulario(req.body),
    });
  }

  try {
    // update conserva la imagen y el estado porque esos campos no forman parte
    // del formulario de informacion general.
    await propiedad.update(datosPropiedad(req.body));
    return res.redirect("/mis-propiedades?resultado=editada");
  } catch (error) {
    console.error("No fue posible editar la propiedad:", error);

    return renderFormulario(req, res, {
      pagina: `Editar: ${propiedad.titulo}`,
      action: `/propiedades/editar/${propiedad.id}`,
      textoBoton: "Guardar cambios",
      esEdicion: true,
      errores: [{ msg: "No fue posible guardar los cambios" }],
      propiedad: datosParaFormulario(req.body),
    });
  }
};

const eliminar = async (req, res) => {
  const propiedad = await Propiedad.findOne({
    where: {
      id: req.params.id,
      usuarioId: req.usuario.id,
    },
  });

  if (!propiedad) {
    return res.redirect("/mis-propiedades");
  }

  const nombreImagen = propiedad.imagen;
  await propiedad.destroy();

  // El archivo se elimina despues del registro para no dejar datos apuntando
  // a una imagen que ya no existe si MySQL falla.
  if (nombreImagen) {
    const rutaImagen = path.resolve("public/uploads", nombreImagen);
    await unlink(rutaImagen).catch((error) => {
      if (error.code !== "ENOENT") {
        console.error("No fue posible eliminar la imagen:", error);
      }
    });
  }

  return res.redirect("/mis-propiedades?resultado=eliminada");
};

// Alterna la publicacion de una propiedad perteneciente al usuario autenticado.
// Responde JSON para fetch y redirige cuando se utiliza el formulario normal.
const cambiarEstado = async (req, res) => {
  const { id } = req.params;
  const solicitaJson = req.get("accept")?.includes("application/json");

  try {
    // La propiedad y su propietario se comprueban en la misma consulta.
    const propiedad = await Propiedad.findOne({
      where: {
        id,
        usuarioId: req.usuario.id,
      },
    });

    if (!propiedad) {
      if (solicitaJson) {
        return res.status(404).json({
          resultado: false,
          mensaje: "La propiedad no existe o no puedes modificarla.",
        });
      }

      return res.redirect("/mis-propiedades");
    }

    // Nunca permitimos publicar un anuncio que todavía no tenga imagen.
    if (!propiedad.publicado && !propiedad.imagen) {
      if (solicitaJson) {
        return res.status(422).json({
          resultado: false,
          mensaje: "Agrega una imagen antes de publicar la propiedad.",
        });
      }

      return res.redirect("/mis-propiedades?resultado=sin-imagen");
    }

    propiedad.publicado = !propiedad.publicado;
    await propiedad.save();

    const mensaje = propiedad.publicado
      ? "La propiedad se publicó correctamente."
      : "La propiedad se pausó correctamente.";

    if (solicitaJson) {
      return res.status(200).json({
        resultado: true,
        publicado: propiedad.publicado,
        mensaje,
      });
    }

    return res.redirect("/mis-propiedades?resultado=estado");
  } catch (error) {
    console.error("No fue posible cambiar el estado de la propiedad:", error);

    if (solicitaJson) {
      return res.status(500).json({
        resultado: false,
        mensaje: "No fue posible actualizar la propiedad.",
      });
    }

    return res.redirect("/mis-propiedades");
  }
};

const agregarImagen = async (req, res) => {
  const { propiedad } = req;

  return res.render("propiedades/agregar-imagen", {
    pagina: `Agregar Imagen: ${propiedad.titulo}`,
    usuario: req.usuario,
    csrfToken: req.csrfToken(),
    propiedad,
    // Esta etapa usa el layout privado, pero no necesita footer.
    sinFooter: true,
  });
};

const validarPropiedadPendiente = async (req, res, next) => {
  const { id } = req.params;

  try {
    // Validamos la propiedad antes de renderizar o escribir archivos en disco.
    const propiedad = await Propiedad.findOne({
      where: {
        id,
        usuarioId: req.usuario.id,
        publicado: false,
      },
      attributes: ["id", "titulo", "imagen", "publicado", "usuarioId"],
    });

    if (!propiedad) {
      if (req.method === "GET") {
        return res.redirect("/mis-propiedades");
      }

      return res
        .status(404)
        .json({ mensaje: "La propiedad no existe o no puedes modificarla" });
    }

    req.propiedad = propiedad;
    return next();
  } catch (error) {
    console.error(error);

    if (req.method === "GET") {
      return res.redirect("/mis-propiedades");
    }

    return res
      .status(500)
      .json({ mensaje: "No fue posible validar la propiedad" });
  }
};

const subirImagen = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      mensaje: "Selecciona una imagen valida",
    });
  }

  try {
    // Multer guarda el archivo y aqui persistimos su nombre en la propiedad.
    req.propiedad.imagen = req.file.filename;
    req.propiedad.publicado = true;
    await req.propiedad.save();

    return res.status(200).json({
      mensaje: "Imagen guardada correctamente",
      imagen: req.file.filename,
      redirect: "/mis-propiedades",
    });
  } catch (error) {
    console.error(error);

    // Si MySQL falla despues de que Multer escribio el archivo, lo eliminamos.
    if (req.file?.path) {
      await unlink(req.file.path).catch(() => {});
    }

    return res.status(500).json({
      mensaje: "No fue posible guardar la imagen",
    });
  }
};

// Muestra el detalle publico de una propiedad publicada.
const mostrarPropiedad = async (req, res) => {
  // El origen es un id de seccion del inicio, nunca una URL externa.
  // Validarlo evita construir fragmentos con caracteres inesperados.
  const origenSolicitado = String(req.query.origen || "");
  const origen = /^[a-z0-9-]+$/.test(origenSolicitado)
    ? origenSolicitado
    : "mapa-inicio";
  const volverA = `/#${origen}`;

  try {
    const propiedad = await obtenerPropiedadPublicada(req.params.id);

    // obtenerPropiedadPublicada ya filtra por publicado: true. Solamente
    // mostramos el estado 404 cuando el anuncio no existe o está pausado.
    if (!propiedad) {
      return res.status(404).render("propiedades/mostrar", {
        pagina: "Propiedad no disponible",
        propiedad: null,
        usuarioAutenticado: req.usuario ?? null,
        esVendedor: false,
        csrfToken: req.csrfToken(),
        volverA,
      });
    }

    const usuarioEsVendedor = esVendedor(req.usuario?.id, propiedad.usuarioId);

    return res.render("propiedades/mostrar", {
      pagina: propiedad.titulo,
      propiedad,
      // Separamos al visitante autenticado del propietario del anuncio,
      // disponible como propiedad.usuario.
      usuarioAutenticado: req.usuario ?? null,
      esVendedor: usuarioEsVendedor,
      csrfToken: req.csrfToken(),
      mensajeEnviado: req.query.enviado === "1",
      volverA,
    });
  } catch (error) {
    console.error("No fue posible mostrar la propiedad:", error);

    return res.status(500).render("propiedades/mostrar", {
      pagina: "Propiedad no disponible",
      propiedad: null,
      usuarioAutenticado: req.usuario ?? null,
      esVendedor: false,
      csrfToken: req.csrfToken(),
      volverA,
      error:
        "No fue posible cargar la propiedad en este momento. Intenta nuevamente.",
    });
  }
};

// Guarda el mensaje de un usuario autenticado que no es dueño del anuncio.
const enviarMensaje = async (req, res) => {
  const mensaje = String(req.body.mensaje || "").trim();
  const origenSolicitado = String(req.body.origen || "");
  const origen = /^[a-z0-9-]+$/.test(origenSolicitado)
    ? origenSolicitado
    : "mapa-inicio";

  // Un visitante sin sesion no tiene usuarioId para asociar al mensaje.
  if (!req.usuario) {
    return res.redirect("/auth/login");
  }

  await check("mensaje")
    .trim()
    .notEmpty()
    .withMessage("El mensaje es obligatorio")
    .bail()
    .isLength({ max: 200 })
    .withMessage("El mensaje no puede exceder 200 caracteres")
    .run(req);

  const resultado = validationResult(req);

  if (!resultado.isEmpty()) {
    const propiedad = await obtenerPropiedadPublicada(req.params.id);

    if (!propiedad) {
      return res.redirect("/404");
    }

    return res.status(422).render("propiedades/mostrar", {
      pagina: propiedad.titulo,
      propiedad,
      usuarioAutenticado: req.usuario,
      esVendedor: esVendedor(req.usuario.id, propiedad.usuarioId),
      csrfToken: req.csrfToken(),
      mensajeEnviado: false,
      erroresMensaje: resultado.array(),
      mensajeEscrito: mensaje,
      volverA: `/#${origen}`,
    });
  }

  try {
    const propiedad = await obtenerPropiedadPublicada(req.params.id);

    if (!propiedad) {
      return res.redirect("/404");
    }

    // El propietario no puede enviarse mensajes a si mismo.
    if (esVendedor(req.usuario.id, propiedad.usuarioId)) {
      return res.redirect(`/propiedad/${propiedad.id}?origen=${origen}`);
    }

    await Mensaje.create({
      mensaje,
      propiedadId: propiedad.id,
      usuarioId: req.usuario.id,
    });

    return res.redirect(
      `/propiedad/${propiedad.id}?origen=${origen}&enviado=1`,
    );
  } catch (error) {
    console.error("No fue posible guardar el mensaje:", error);

    const propiedad = await obtenerPropiedadPublicada(req.params.id);

    if (!propiedad) {
      return res.redirect("/404");
    }

    return res.status(500).render("propiedades/mostrar", {
      pagina: propiedad.titulo,
      propiedad,
      usuarioAutenticado: req.usuario,
      esVendedor: esVendedor(req.usuario.id, propiedad.usuarioId),
      csrfToken: req.csrfToken(),
      mensajeEnviado: false,
      erroresMensaje: [
        {
          msg: "No fue posible enviar el mensaje. Intenta nuevamente.",
        },
      ],
      mensajeEscrito: mensaje,
      volverA: `/#${origen}`,
    });
  }
};

// Muestra los mensajes recibidos por una propiedad del usuario autenticado.
const verMensajes = async (req, res) => {
  try {
    const propiedad = await Propiedad.findOne({
      where: {
        id: req.params.id,
        usuarioId: req.usuario.id,
      },
      attributes: ["id", "titulo", "imagen"],
      include: [
        {
          model: Mensaje,
          as: "mensajes",
          attributes: ["id", "mensaje", "leido", "createdAt"],
          // Al separar la consulta podemos ordenar correctamente la relacion
          // hasMany sin alterar el resultado principal de la propiedad.
          separate: true,
          order: [["createdAt", "DESC"]],
          include: [
            {
              model: Usuario,
              as: "usuario",
              attributes: ["id", "nombre", "email"],
            },
          ],
        },
      ],
    });

    // Evita que un usuario autenticado consulte mensajes de otra propiedad.
    if (!propiedad) {
      return res.redirect("/mis-propiedades");
    }

    return res.render("propiedades/mensajes", {
      pagina: "Mensajes",
      propiedad,
      mensajes: propiedad.mensajes,
      usuario: req.usuario,
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("No fue posible obtener los mensajes:", error);

    return res.status(500).render("propiedades/mensajes", {
      pagina: "Mensajes",
      propiedad: null,
      mensajes: [],
      errores: [
        {
          msg: "No fue posible cargar los mensajes. Intenta nuevamente.",
        },
      ],
      usuario: req.usuario,
      csrfToken: req.csrfToken(),
    });
  }
};

// Marca como leído un mensaje que pertenece a una propiedad del vendedor.
const marcarMensajeLeido = async (req, res) => {
  try {
    const mensaje = await Mensaje.findOne({
      where: {
        id: req.params.id,
      },
      include: [
        {
          model: Propiedad,
          as: "propiedad",
          attributes: ["id"],
          where: {
            usuarioId: req.usuario.id,
          },
          required: true,
        },
      ],
    });

    // La relación con Propiedad impide modificar mensajes de otro vendedor.
    if (!mensaje) {
      return res.redirect("/mis-propiedades");
    }

    if (!mensaje.leido) {
      mensaje.leido = true;
      await mensaje.save();
    }

    return res.redirect(
      `/mensajes/${mensaje.propiedadId}#mensaje-${mensaje.id}`,
    );
  } catch (error) {
    console.error("No fue posible marcar el mensaje como leído:", error);
    return res.redirect("/mis-propiedades");
  }
};

export {
  admin,
  crear,
  guardar,
  editar,
  guardarCambios,
  eliminar,
  cambiarEstado,
  agregarImagen,
  validarPropiedadPendiente,
  subirImagen,
  mostrarPropiedad,
  enviarMensaje,
  verMensajes,
  marcarMensajeLeido,
};
