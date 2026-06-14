import { Categoria, Precio, Propiedad } from "../models/index.js";
import { Op } from "sequelize";

const PROPIEDADES_POR_PAGINA = 9;

// Construye un paginador compacto con páginas cercanas y puntos suspensivos.
const crearRangoPaginas = (paginaActual, totalPaginas) => {
  const paginasVisibles = [
    1,
    paginaActual - 1,
    paginaActual,
    paginaActual + 1,
    totalPaginas,
  ]
    .filter((pagina) => pagina >= 1 && pagina <= totalPaginas)
    .filter((pagina, indice, paginas) => paginas.indexOf(pagina) === indice)
    .sort((a, b) => a - b);

  return paginasVisibles.reduce((resultado, pagina, indice) => {
    const paginaAnterior = paginasVisibles[indice - 1];

    if (paginaAnterior && pagina - paginaAnterior > 1) {
      resultado.push("...");
    }

    resultado.push(pagina);
    return resultado;
  }, []);
};

// Muestra la pagina publica de inicio.
// Las categorias se renderizan con Pug y las propiedades del mapa se consultan
// desde el navegador mediante el endpoint /api/propiedades.
const inicio = async (req, res) => {
  try {
    // Ambas consultas son independientes, por lo que se ejecutan en paralelo.
    // Estos datos alimentan las tarjetas y los filtros del mapa.
    const [categorias, precios, casas, departamentos] = await Promise.all([
      Categoria.findAll({
        attributes: ["id", "nombre"],
        order: [["nombre", "ASC"]],
      }),
      Precio.findAll({
        attributes: ["id", "precio"],
        order: [["id", "ASC"]],
      }),
      Propiedad.findAll({
        limit: 3,
        where: {
          categoriaId: 1,
          publicado: true,
        },
        attributes: [
          "id",
          "titulo",
          "imagen",
          "calle",
          "habitaciones",
          "estacionamiento",
          "wc",
        ],
        include: [
          {
            model: Precio,
            as: "precio",
            attributes: ["id", "precio"],
          },
        ],
        order: [["createdAt", "DESC"]],
      }),

      Propiedad.findAll({
        limit: 3,
        where: {
          categoriaId: 2,
          publicado: true,
        },
        attributes: [
          "id",
          "titulo",
          "imagen",
          "calle",
          "habitaciones",
          "estacionamiento",
          "wc",
        ],
        include: [
          {
            model: Precio,
            as: "precio",
            attributes: ["id", "precio"],
          },
        ],
        order: [["createdAt", "DESC"]],
      }),
    ]);

    return res.render("inicio", {
      pagina: "Inicio",
      categorias,
      precios,
      casas,
      departamentos,
    });
  } catch (error) {
    console.error("No fue posible cargar la pagina de inicio:", error);

    return res.status(500).render("inicio", {
      pagina: "Inicio",
      categorias: [],
      precios: [],
      casas: [],
      departamentos: [],
      error: "No fue posible cargar los filtros en este momento.",
    });
  }
};

const categoria = async (req, res) => {
  try {
    const { id } = req.params;
    const paginaSolicitada = req.query.pagina || "1";

    // Los identificadores de categorias son enteros positivos.
    if (!/^[1-9]\d*$/.test(id)) {
      return res.redirect("/404");
    }

    // Evita valores negativos, decimales o texto en la paginacion.
    if (!/^[1-9]\d*$/.test(paginaSolicitada)) {
      return res.redirect(`/categorias/${id}?pagina=1`);
    }

    const paginaActual = Number.parseInt(paginaSolicitada, 10);
    const offset = (paginaActual - 1) * PROPIEDADES_POR_PAGINA;

    // Primero comprobamos que la categoria solicitada exista.
    const categoriaSeleccionada = await Categoria.findByPk(id, {
      attributes: ["id", "nombre"],
    });

    if (!categoriaSeleccionada) {
      return res.redirect("/404");
    }

    // El escaparate publico sólo muestra propiedades publicadas.
    const resultado = await Propiedad.findAndCountAll({
      where: {
        categoriaId: categoriaSeleccionada.id,
        publicado: true,
      },
      limit: PROPIEDADES_POR_PAGINA,
      offset,
      attributes: [
        "id",
        "titulo",
        "imagen",
        "calle",
        "habitaciones",
        "estacionamiento",
        "wc",
      ],
      include: [
        {
          model: Precio,
          as: "precio",
          attributes: ["id", "precio"],
        },
      ],
      order: [["createdAt", "DESC"]],
      distinct: true,
    });

    const totalPropiedades = resultado.count;
    const totalPaginas = Math.ceil(totalPropiedades / PROPIEDADES_POR_PAGINA);

    // Si desaparecen registros de la última página, regresamos a la última
    // página que todavía existe.
    if (
      paginaActual > 1 &&
      (totalPropiedades === 0 || paginaActual > totalPaginas)
    ) {
      return res.redirect(
        `/categorias/${categoriaSeleccionada.id}?pagina=${Math.max(totalPaginas, 1)}`,
      );
    }

    return res.render("categoria", {
      pagina: `${categoriaSeleccionada.nombre}s en venta`,
      categoria: categoriaSeleccionada,
      propiedades: resultado.rows,
      totalPropiedades,
      paginacion: {
        paginaActual,
        totalPaginas,
        rango: crearRangoPaginas(paginaActual, totalPaginas),
      },
    });
  } catch (error) {
    console.error("No fue posible cargar la categoria:", error);

    return res.status(500).render("categoria", {
      pagina: "Propiedades no disponibles",
      categoria: null,
      propiedades: [],
      totalPropiedades: 0,
      paginacion: {
        paginaActual: 1,
        totalPaginas: 0,
        rango: [],
      },
      error: "No fue posible cargar las propiedades en este momento.",
    });
  }
};

// Muestra una respuesta publica para categorias o rutas no encontradas.
const noEncontrado = (req, res) =>
  res.status(404).render("404", {
    pagina: "Página no encontrada",
    mensaje:
      "La página que buscas no existe, cambió de dirección o ya no está disponible.",
  });

// Busca coincidencias en el titulo y la descripcion de anuncios publicados.
// Utilizamos GET porque la busqueda sólo consulta datos y su URL puede
// compartirse, recargarse o guardarse en favoritos.
const buscador = async (req, res) => {
  const termino = String(req.query.termino || "").trim();

  if (!termino) {
    return res.redirect("/");
  }

  if (termino.length > 100) {
    return res.status(400).render("busqueda", {
      pagina: "Resultados de búsqueda",
      termino: termino.slice(0, 100),
      propiedades: [],
      error: "La búsqueda no puede exceder 100 caracteres.",
    });
  }

  try {
    const propiedades = await Propiedad.findAll({
      where: {
        publicado: true,
        [Op.or]: [
          {
            titulo: {
              [Op.like]: `%${termino}%`,
            },
          },
          {
            descripcion: {
              [Op.like]: `%${termino}%`,
            },
          },
          {
            calle: {
              [Op.like]: `%${termino}%`,
            },
          },
        ],
      },
      attributes: [
        "id",
        "titulo",
        "imagen",
        "calle",
        "habitaciones",
        "estacionamiento",
        "wc",
      ],
      include: [
        {
          model: Precio,
          as: "precio",
          attributes: ["id", "precio"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.render("busqueda", {
      pagina: `Resultados para: ${termino}`,
      termino,
      propiedades,
    });
  } catch (error) {
    console.error("No fue posible realizar la búsqueda:", error);

    return res.status(500).render("busqueda", {
      pagina: "Resultados de búsqueda",
      termino,
      propiedades: [],
      error: "No fue posible realizar la búsqueda en este momento.",
    });
  }
};

export { inicio, categoria, noEncontrado, buscador };
