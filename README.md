# 🧩 API REST - Gestión de Usuarios

## 📘 Descripción

Esta API REST fue desarrollada con **Node.js** y **Express** para la **gestión de usuarios**, permitiendo realizar operaciones CRUD (crear, listar, actualizar y eliminar usuarios).  
Cuenta con validaciones para evitar duplicidad de DPI o correos electrónicos y asegurar contraseñas seguras.

El proyecto fue desplegado en **Render**, y la API está disponible en la siguiente dirección:

🔗 **URL de la API:** https://api-usuarios-2a6x.onrender.com

### 1️⃣ POST `/users`
Crea un nuevo usuario.

**📥 Ejemplo de solicitud (JSON):**
```json
{
  "dpi": "1234567890123",
  "name": "Keily Andrea",
  "email": "keily@example.com",
  "password": "Password@123"
}
