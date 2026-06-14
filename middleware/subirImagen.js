import multer from "multer";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { generarId } from "../helpers/tokens.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const carpetaUploads = path.resolve(__dirname, "../public/uploads");

// Garantiza que el destino exista también en una instalación nueva.
mkdirSync(carpetaUploads, { recursive: true });

const extensionesPermitidas = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, carpetaUploads);
  },
  filename(req, file, callback) {
    const extension = extensionesPermitidas[file.mimetype];
    callback(null, `${generarId()}${extension}`);
  },
});

const formatosPermitidos = new Set(Object.keys(extensionesPermitidas));

const fileFilter = (req, file, callback) => {
  if (!formatosPermitidos.has(file.mimetype)) {
    return callback(
      new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname),
    );
  }

  return callback(null, true);
};

// Recibe una sola imagen y limita el archivo a 5 MB.
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

const manejarErrorSubida = (error, req, res, next) => {
  if (!(error instanceof multer.MulterError)) {
    return next(error);
  }

  const mensajes = {
    LIMIT_FILE_SIZE: "La imagen supera el limite de 5 MB",
    LIMIT_FILE_COUNT: "Solo puedes subir una imagen",
    LIMIT_UNEXPECTED_FILE: "Selecciona una imagen JPG, PNG o WebP",
  };

  return res.status(400).json({
    mensaje: mensajes[error.code] || "No fue posible procesar la imagen",
  });
};

export default upload;
export { manejarErrorSubida };
