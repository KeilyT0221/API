require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_key';
const JWT_EXPIRES_IN = '30s';

// Middleware
app.use(cors());
app.use(express.json());

// Helper functions
const readUsers = () => {
    try {
        if (!fs.existsSync(USERS_FILE)) {
            return [];
        }
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

const writeUsers = (users) => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

const validateDPI = (dpi) => {
    return /^\d{13}$/.test(dpi);
};

const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const validatePassword = (password) => {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    return password.length >= 8 && hasUpperCase && hasNumber && hasSymbol;
};

const userExists = (users, dpi, email, excludeDpi = null) => {
    return users.some(user => 
        (user.dpi === dpi && user.dpi !== excludeDpi) || 
        (user.email === email && user.dpi !== excludeDpi)
    );
};

// Middleware de autenticación JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            error: 'Token de autenticación no proporcionado'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(403).json({
                    error: 'Token expirado'
                });
            }
            return res.status(403).json({
                error: 'Token inválido'
            });
        }
        req.user = user;
        next();
    });
};

// POST /login - Autenticación de usuario
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            error: 'Email y password son requeridos'
        });
    }

    const users = readUsers();
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
        return res.status(401).json({
            error: 'Credenciales inválidas'
        });
    }

    // Generar token JWT
    const token = jwt.sign(
        { 
            dpi: user.dpi, 
            email: user.email,
            name: user.name 
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
        message: 'Autenticación exitosa',
        token,
        expiresIn: JWT_EXPIRES_IN,
        user: {
            dpi: user.dpi,
            name: user.name,
            email: user.email
        }
    });
});

// POST /users - Crear nuevo usuario (NO PROTEGIDO - para registro)
app.post('/users', (req, res) => {
    const { dpi, name, email, password } = req.body;

    // Validaciones requeridas
    if (!dpi || !name || !email || !password) {
        return res.status(400).json({
            error: 'Todos los campos son requeridos: dpi, name, email, password'
        });
    }

    // Validar DPI
    if (!validateDPI(dpi)) {
        return res.status(400).json({
            error: 'El DPI debe tener exactamente 13 dígitos numéricos'
        });
    }

    // Validar email
    if (!validateEmail(email)) {
        return res.status(400).json({
            error: 'El formato del email no es válido'
        });
    }

    // Validar password
    if (!validatePassword(password)) {
        return res.status(400).json({
            error: 'El password debe tener al menos 8 caracteres, incluir una mayúscula, un número y un símbolo'
        });
    }

    const users = readUsers();

    // Verificar si el usuario ya existe
    if (userExists(users, dpi, email)) {
        return res.status(409).json({
            error: 'El DPI o email ya está registrado en el sistema'
        });
    }

    // Crear nuevo usuario
    const newUser = {
        dpi,
        name,
        email,
        password, // En producción, esto debería estar hasheado
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    users.push(newUser);
    writeUsers(users);

    // No exponer el password en la respuesta
    const { password: _, ...userResponse } = newUser;
    
    res.status(201).json({
        message: 'Usuario creado exitosamente',
        user: userResponse
    });
});

// GET /users - Listar usuarios (PROTEGIDO)
app.get('/users', authenticateToken, (req, res) => {
    const { name, email, limit, offset } = req.query;
    let users = readUsers();

    // Aplicar filtros
    if (name) {
        users = users.filter(user => 
            user.name.toLowerCase().includes(name.toLowerCase())
        );
    }

    if (email) {
        users = users.filter(user => user.email === email);
    }

    // Aplicar paginación
    const startIndex = parseInt(offset) || 0;
    const endIndex = startIndex + (parseInt(limit) || users.length);
    const paginatedUsers = users.slice(startIndex, endIndex);

    // No exponer passwords
    const usersWithoutPasswords = paginatedUsers.map(({ password, ...user }) => user);

    res.json({
        total: users.length,
        count: usersWithoutPasswords.length,
        offset: startIndex,
        limit: endIndex - startIndex,
        users: usersWithoutPasswords
    });
});

// PUT /users/:dpi - Actualizar usuario (PROTEGIDO)
app.put('/users/:dpi', authenticateToken, (req, res) => {
    const { dpi } = req.params;
    const { name, email, password, newDpi } = req.body;

    // Validar que el DPI del parámetro sea válido
    if (!validateDPI(dpi)) {
        return res.status(400).json({
            error: 'El DPI del parámetro debe tener exactamente 13 dígitos numéricos'
        });
    }

    const users = readUsers();
    const userIndex = users.findIndex(user => user.dpi === dpi);

    if (userIndex === -1) {
        return res.status(404).json({
            error: 'Usuario no encontrado'
        });
    }

    const user = users[userIndex];
    const updates = {};

    // Validar nuevo DPI si se proporciona
    if (newDpi) {
        if (!validateDPI(newDpi)) {
            return res.status(400).json({
                error: 'El nuevo DPI debe tener exactamente 13 dígitos numéricos'
            });
        }
        if (userExists(users, newDpi, null, dpi)) {
            return res.status(409).json({
                error: 'El nuevo DPI ya está registrado en otro usuario'
            });
        }
        updates.dpi = newDpi;
    }

    // Validar y actualizar email
    if (email) {
        if (!validateEmail(email)) {
            return res.status(400).json({
                error: 'El formato del email no es válido'
            });
        }
        if (userExists(users, null, email, dpi)) {
            return res.status(409).json({
                error: 'El email ya está registrado en otro usuario'
            });
        }
        updates.email = email;
    }

    // Validar y actualizar password
    if (password) {
        if (!validatePassword(password)) {
            return res.status(400).json({
                error: 'El password debe tener al menos 8 caracteres, incluir una mayúscula, un número y un símbolo'
            });
        }
        updates.password = password;
    }

    // Actualizar nombre si se proporciona
    if (name) {
        updates.name = name;
    }

    // Aplicar actualizaciones
    const updatedUser = {
        ...user,
        ...updates,
        updatedAt: new Date().toISOString()
    };

    users[userIndex] = updatedUser;
    writeUsers(users);

    // No exponer el password en la respuesta
    const { password: _, ...userResponse } = updatedUser;

    res.json({
        message: 'Usuario actualizado exitosamente',
        user: userResponse
    });
});

// DELETE /users/:dpi - Eliminar usuario (PROTEGIDO)
app.delete('/users/:dpi', authenticateToken, (req, res) => {
    const { dpi } = req.params;

    // Validar formato del DPI
    if (!validateDPI(dpi)) {
        return res.status(400).json({
            error: 'El DPI debe tener exactamente 13 dígitos numéricos'
        });
    }

    const users = readUsers();
    const userIndex = users.findIndex(user => user.dpi === dpi);

    if (userIndex === -1) {
        return res.status(404).json({
            error: 'Usuario no encontrado'
        });
    }

    const deletedUser = users.splice(userIndex, 1)[0];
    writeUsers(users);

    // No exponer el password en la respuesta
    const { password, ...userResponse } = deletedUser;

    res.json({
        message: 'Usuario eliminado exitosamente',
        user: userResponse
    });
});

// Ruta de salud
app.get('/', (req, res) => {
    res.json({
        message: 'API de Gestión de Usuarios con JWT',
        version: '2.0.0',
        endpoints: {
            'POST /login': 'Autenticar usuario y obtener token',
            'POST /users': 'Crear nuevo usuario (público)',
            'GET /users': 'Listar usuarios (requiere token)',
            'PUT /users/:dpi': 'Actualizar usuario (requiere token)',
            'DELETE /users/:dpi': 'Eliminar usuario (requiere token)'
        }
    });
});

app.use((req, res) => {
    res.status(404).json({
        error: 'Ruta no encontrada',
        path: req.path,
        method: req.method
    });
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Error interno del servidor'
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
    console.log(`URL: http://localhost:${PORT}`);
});