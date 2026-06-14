import L from "leaflet";
import { GeoSearchControl, OpenStreetMapProvider } from "leaflet-geosearch";

// Este archivo se compila con Webpack hacia public/js/mapa.js.
// Si la vista actual no tiene mapa, salimos para no afectar otras paginas.
const mapaContenedor = document.querySelector("#mapa");

if (mapaContenedor) {
  const latInput = document.querySelector("#lat");
  const lngInput = document.querySelector("#lng");
  const calleInput = document.querySelector("#calle");
  const ubicacionInput = document.querySelector("#ubicacion");
  let ultimaBusqueda = 0;

  // Coordenadas iniciales: Cuernavaca, Morelos, Mexico.
  const coordenadasIniciales = {
    lat: 18.9242,
    lng: -99.2216,
  };

  const mapa = L.map(mapaContenedor).setView(
    [coordenadasIniciales.lat, coordenadasIniciales.lng],
    13,
  );

  // OpenStreetMap es buena opcion para aprendizaje; para produccion conviene
  // revisar limites de uso o contratar un proveedor de tiles/geocoding.
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);

  const marker = L.marker(
    [coordenadasIniciales.lat, coordenadasIniciales.lng],
    {
      draggable: true,
      autoPan: true,
    },
  ).addTo(mapa);

  const actualizarCoordenadas = ({ lat, lng }) => {
    if (!latInput || !lngInput) return;

    // Guardamos coordenadas con 6 decimales: suficiente precision para ubicar una propiedad.
    latInput.value = lat.toFixed(6);
    lngInput.value = lng.toFixed(6);
  };

  const actualizarCalle = (calle = "") => {
    // Este input es hidden en crear.pug; aqui guardamos la direccion que ira a la BD.
    if (calleInput) {
      calleInput.value = calle;
    }

    // Este input visible permite revisar o completar el numero exterior.
    if (ubicacionInput) {
      ubicacionInput.value = calle;
    }
  };

  const limpiarUbicacion = () => {
    if (latInput) latInput.value = "";
    if (lngInput) lngInput.value = "";

    actualizarCalle("");
  };

  const obtenerDireccionCompleta = (resultado) => {
    const direccion = resultado.address || {};
    const calle = direccion.road || direccion.pedestrian || direccion.footway;
    const numero = direccion.house_number;
    const colonia =
      direccion.neighbourhood || direccion.suburb || direccion.quarter;
    const ciudad = direccion.city || direccion.town || direccion.village;
    const estado = direccion.state;
    const pais = direccion.country;

    const partes = [
      [calle, numero].filter(Boolean).join(" "),
      colonia,
      ciudad,
      estado,
      pais,
    ].filter(Boolean);

    return partes.length ? partes.join(", ") : resultado.display_name || "";
  };

  const actualizarDireccion = async ({ lat, lng }) => {
    if (!calleInput && !ubicacionInput) return;

    const busquedaActual = ++ultimaBusqueda;
    const url = new URL("https://nominatim.openstreetmap.org/reverse");

    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", lat);
    url.searchParams.set("lon", lng);
    url.searchParams.set("zoom", "18");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "es");

    try {
      const respuesta = await fetch(url);
      const resultado = await respuesta.json();

      // Evita que una respuesta vieja sobreescriba la ubicacion mas reciente.
      if (busquedaActual !== ultimaBusqueda) return;

      actualizarCalle(obtenerDireccionCompleta(resultado));
    } catch (error) {
      console.error("No fue posible obtener la direccion", error);
    }
  };

  const actualizarUbicacion = (posicion, { centrarMapa = false } = {}) => {
    actualizarCoordenadas(posicion);
    actualizarDireccion(posicion);

    if (centrarMapa) {
      mapa.panTo(posicion);
    }
  };

  const obtenerUbicacionGuardada = () => {
    const lat = Number.parseFloat(latInput?.value);
    const lng = Number.parseFloat(lngInput?.value);

    if (!calleInput?.value || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    return { lat, lng };
  };

  // El mapa inicia centrado en Cuernavaca, pero no guardamos ubicacion todavia.
  // El usuario debe buscar una direccion o mover el pin para llenar calle, lat y lng.
  const ubicacionGuardada = obtenerUbicacionGuardada();

  if (ubicacionGuardada) {
    marker.setLatLng(ubicacionGuardada);
    mapa.setView([ubicacionGuardada.lat, ubicacionGuardada.lng], 16);
  } else {
    limpiarUbicacion();
  }

  // Si el proveedor no devuelve numero exterior, el usuario puede escribirlo aqui.
  ubicacionInput?.addEventListener("input", (event) => {
    if (calleInput) {
      calleInput.value = event.target.value;
    }
  });

  // moveend funciona tanto cuando el usuario arrastra el pin como cuando el codigo lo mueve.
  marker.on("moveend", (event) => {
    const posicion = event.target.getLatLng();

    actualizarUbicacion(posicion, { centrarMapa: true });
  });

  const provider = new OpenStreetMapProvider();

  const buscador = new GeoSearchControl({
    provider,
    style: "bar",
    searchLabel: "Buscar direccion",
    autoComplete: true,
    autoCompleteDelay: 300,
    showMarker: false,
    retainZoomLevel: false,
    animateZoom: true,
  });

  mapa.addControl(buscador);

  // Cuando el usuario elige una direccion, centramos el mapa y movemos el pin.
  mapa.on("geosearch/showlocation", (resultado) => {
    const { x: lng, y: lat, label } = resultado.location;
    const posicion = { lat, lng };

    marker.setLatLng(posicion);
    mapa.setView([lat, lng], 16);
    actualizarCalle(label);
  });
}
