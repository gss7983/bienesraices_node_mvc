import L from "leaflet";

// Este mapa es informativo: muestra la ubicacion guardada, pero el marcador
// permanece fijo para que el visitante no pueda modificarla.
const mapaContenedor = document.querySelector("#mapa");

if (mapaContenedor) {
  const lat = Number.parseFloat(mapaContenedor.dataset.lat);
  const lng = Number.parseFloat(mapaContenedor.dataset.lng);
  const calle =
    mapaContenedor.dataset.calle || "Ubicacion de la propiedad publicada";

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const coordenadas = [lat, lng];
    const mapa = L.map(mapaContenedor, {
      scrollWheelZoom: false,
    }).setView(coordenadas, 16);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa);

    const marcador = L.marker(coordenadas, {
      draggable: false,
      title: calle,
      alt: `Ubicacion: ${calle}`,
    }).addTo(mapa);

    const textoTooltip = document.createElement("span");
    textoTooltip.textContent = calle;

    const contenidoPopup = document.createElement("div");
    const tituloPopup = document.createElement("strong");
    const direccionPopup = document.createElement("p");

    tituloPopup.textContent = "Ubicacion";
    direccionPopup.textContent = calle;
    direccionPopup.className = "mt-1";
    contenidoPopup.append(tituloPopup, direccionPopup);

    // Tooltip al colocar el cursor y popup al hacer clic o usar el teclado.
    marcador.bindTooltip(textoTooltip, {
      direction: "top",
      offset: [0, -12],
    });
    marcador.bindPopup(contenidoPopup);

    // Leaflet necesita recalcular el tamaño cuando vive dentro de un grid.
    window.requestAnimationFrame(() => mapa.invalidateSize());
  } else {
    mapaContenedor.textContent = "Ubicacion no disponible";
    mapaContenedor.classList.add(
      "grid",
      "place-items-center",
      "px-5",
      "text-center",
      "text-sm",
      "font-semibold",
      "text-slate-500",
    );
  }
}
