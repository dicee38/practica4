const express = require('express');
const router = express.Router();
const { registerUser, loginUser, protectedRoute, authMiddleware } = require('../controllers/authController');

// Регистрация
router.post('/register', registerUser);

// Вход
router.post('/login', loginUser);

// Защищённый ресурс
router.get('/protected', authMiddleware, protectedRoute);

module.exports = router;
