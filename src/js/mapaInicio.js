import L from "leaflet";

// Coordenadas iniciales de Cuernavaca, Morelos, Mexico.
const coordenadasIniciales = [18.9242, -99.2216];
const mapaContenedor = document.querySelector("#mapa-inicio");
const categoriasSelect = document.querySelector("#categorias");
const preciosSelect = document.querySelector("#precios");

// Conserva las selecciones actuales. Una cadena vacia significa "todos".
const filtros = {
  categoria: "",
  precio: "",
};

// Convierte una propiedad del API en contenido seguro para el popup.
// Se crean nodos del DOM en lugar de insertar HTML recibido desde la base.
const crearPopup = (propiedad) => {
  const contenedor = document.createElement("article");
  contenedor.className = "w-56";

  if (propiedad.imagen) {
    const imagen = document.createElement("img");
    imagen.src = `/uploads/${encodeURIComponent(propiedad.imagen)}`;
    imagen.alt = `Imagen de ${propiedad.titulo}`;
    imagen.className = "mb-3 h-28 w-full rounded object-cover";
    contenedor.append(imagen);
  }

  const categoria = document.createElement("p");
  categoria.className = "text-xs font-bold uppercase text-emerald-700";
  categoria.textContent = propiedad.categoria?.nombre || "Propiedad";

  const titulo = document.createElement("h3");
  titulo.className = "mt-1 text-base font-extrabold text-slate-900";
  titulo.textContent = propiedad.titulo;

  const precio = document.createElement("p");
  precio.className = "mt-1 font-bold text-emerald-700";
  precio.textContent = propiedad.precio?.precio || "Precio no disponible";

  const direccion = document.createElement("p");
  direccion.className = "mt-2 text-sm text-slate-600";
  direccion.textContent = propiedad.calle;

  const enlace = document.createElement("a");
  enlace.href = `/propiedad/${encodeURIComponent(propiedad.id)}?origen=mapa-inicio`;
  enlace.className =
    "mt-3 inline-flex font-bold text-emerald-700 hover:text-emerald-800";
  enlace.textContent = "Ver propiedad";

  contenedor.append(categoria, titulo, precio, direccion, enlace);

  return contenedor;
};

const mostrarError = (mensaje) => {
  mapaContenedor.querySelector("[data-aviso-mapa]")?.remove();

  const aviso = document.createElement("p");
  aviso.className =
    "absolute left-1/2 top-4 z-[1000] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border border-red-200 bg-white px-4 py-3 text-center text-sm font-semibold text-red-700 shadow";
  aviso.textContent = mensaje;
  aviso.setAttribute("role", "alert");
  aviso.dataset.avisoMapa = "";
  mapaContenedor.append(aviso);
};

// Comprueba si la propiedad coincide con cada seleccion activa.
const filtrarCategoria = (propiedad) =>
  filtros.categoria === "" ||
  Number(propiedad.categoria?.id) === Number(filtros.categoria);

const filtrarPrecio = (propiedad) =>
  filtros.precio === "" ||
  Number(propiedad.precio?.id) === Number(filtros.precio);

const filtrarPropiedades = (propiedades) =>
  propiedades.filter(
    (propiedad) =>
      filtrarCategoria(propiedad) && filtrarPrecio(propiedad),
  );

// Limpia y vuelve a construir solamente la capa que contiene los pines.
const mostrarPropiedades = (mapa, capaMarcadores, propiedades) => {
  capaMarcadores.clearLayers();
  mapaContenedor.querySelector("[data-aviso-mapa]")?.remove();

  const marcadores = [];

  propiedades.forEach((propiedad) => {
    const lat = Number.parseFloat(propiedad.lat);
    const lng = Number.parseFloat(propiedad.lng);

    // Una coordenada incompleta no debe impedir que aparezcan los demas pines.
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return;
    }

    const marcador = L.marker([lat, lng], {
      title: propiedad.titulo,
      alt: `Ubicacion de ${propiedad.titulo}`,
      autoPan: true,
    }).bindPopup(crearPopup(propiedad), {
      maxWidth: 260,
    });

    marcador.addTo(capaMarcadores);
    marcadores.push(marcador);
  });

  if (marcadores.length === 0) {
    mostrarError("No hay propiedades que coincidan con los filtros.");
    mapa.setView(coordenadasIniciales, 13);
    return;
  }

  // Ajusta la vista para incluir todos los resultados filtrados.
  const grupo = L.featureGroup(marcadores);
  mapa.fitBounds(grupo.getBounds(), {
    padding: [45, 45],
    maxZoom: 15,
  });
};

const cargarPropiedades = async (mapa, capaMarcadores) => {
  try {
    const respuesta = await fetch("/api/propiedades", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!respuesta.ok) {
      throw new Error(`El API respondio con el estado ${respuesta.status}`);
    }

    const datos = await respuesta.json();
    const propiedades = Array.isArray(datos)
      ? datos
      : Array.isArray(datos.propiedades)
        ? datos.propiedades
        : [];

    // Cada cambio usa esta misma coleccion obtenida del API; no es necesario
    // consultar nuevamente al servidor para filtrar.
    const aplicarFiltros = () => {
      const propiedadesFiltradas = filtrarPropiedades(propiedades);
      mostrarPropiedades(mapa, capaMarcadores, propiedadesFiltradas);
    };

    categoriasSelect?.addEventListener("change", (evento) => {
      filtros.categoria = evento.target.value;
      aplicarFiltros();
    });

    preciosSelect?.addEventListener("change", (evento) => {
      filtros.precio = evento.target.value;
      aplicarFiltros();
    });

    aplicarFiltros();
  } catch (error) {
    console.error("No fue posible cargar los marcadores:", error);
    mostrarError("No fue posible cargar las propiedades en el mapa.");
  }
};

if (mapaContenedor) {
  // El contenedor ya tiene alto y ancho definidos en tailwind.css.
  const mapa = L.map(mapaContenedor).setView(coordenadasIniciales, 13);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);

  // La capa permite retirar los pines filtrados sin modificar el mapa base.
  const capaMarcadores = L.layerGroup().addTo(mapa);

  cargarPropiedades(mapa, capaMarcadores);
}
