🧩 API de Gestión de Usuarios

Una API REST desarrollada con Node.js y Express para la gestión de usuarios, que implementa validaciones de DPI único, correo electrónico, y contraseña segura, cumpliendo buenas prácticas de seguridad y estructura de datos.

📋 Características

➕ Crear, listar, actualizar y eliminar usuarios

🔒 Validación de DPI único (13 dígitos exactos)

📧 Validación de email único y formato correcto

🔐 Validación de contraseña segura (mayúsculas, minúsculas, números y caracteres especiales)

🔍 Filtros y paginación para listar usuarios

📘 Documentación completa de la API

🚀 Despliegue

URL de producción:
🔗 https://hoja-trabajo-6-w5he.onrender.com/

📚 Endpoints Principales
🟢 POST /users

Crear un nuevo usuario

Body:

{
  "dpi": "1234567890123",
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "password": "Password123!"
}