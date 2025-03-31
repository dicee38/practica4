const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const users = [];  // Для хранения пользователей в памяти

// Регистрация пользователя
const registerUser = (req, res) => {
  const { username, password } = req.body;
  
  // Проверка, что пользователь уже существует
  const userExists = users.find(user => user.username === username);
  if (userExists) {
    return res.status(400).json({ message: 'Пользователь уже существует' });
  }

  // Хэширование пароля
  const hashedPassword = bcrypt.hashSync(password, 10);

  // Добавление нового пользователя в память
  const newUser = { username, password: hashedPassword };
  users.push(newUser);

  res.status(201).json({ message: 'Пользователь зарегистрирован' });
};

// Вход пользователя
const loginUser = (req, res) => {
  const { username, password } = req.body;

  const user = users.find(u => u.username === username);
  if (!user) {
    return res.status(404).json({ message: 'Пользователь не найден' });
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password);
  if (!isPasswordValid) {
    return res.status(400).json({ message: 'Неверный пароль' });
  }

  const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRATION });
  res.status(200).json({ token });
};

// Защищённый маршрут
const protectedRoute = (req, res) => {
  res.status(200).json({ message: 'Доступ к защищённому ресурсу получен', user: req.user });
};

// Мидлвар для проверки JWT
const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
    return res.status(403).json({ message: 'Токен не предоставлен' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Неверный токен' });
    }
    req.user = decoded;
    next();
  });
};

module.exports = {
  registerUser,
  loginUser,
  protectedRoute,
  authMiddleware
};
