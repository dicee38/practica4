const express = require('express');
const { ApolloServer, gql } = require('apollo-server-express');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const mainPort = 3000;
const adminPort = 8080;
const wsPort = 4000;

const secretKey = 'your-secret-key'; // Токен секрет

// Указываем пути для главной страницы и страницы админки
const mainPagePath = path.join(__dirname, 'views');
const adminPagePath = path.join(__dirname, '..', 'admin-panel');

// Создаем два разных сервера Express для главной страницы и админки
const mainApp = express();
const adminApp = express();

// Статическая папка для главной страницы
mainApp.use(express.static(mainPagePath));

// Статическая папка для админки
adminApp.use('/admin', express.static(adminPagePath));

mainApp.use(cors());
adminApp.use(cors());

// Парсинг JSON для тела запроса
mainApp.use(express.json());
adminApp.use(express.json());

// Данные пользователей (для простоты храним их в памяти, можно использовать БД)
const users = [
  { id: 1, username: 'admin', password: '$2a$10$KcJ7vZmjj6tX8KD.Dq8OFO8U4AfGbgav3Zg1ujE5l8lHwvM7H4kaK' } // Пароль: admin123
];

// Функция для генерации токена
const generateToken = (user) => {
  return jwt.sign({ id: user.id, username: user.username }, secretKey, { expiresIn: '1h' });
};

// Авторизация
const authenticateToken = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  
  if (!token) {
    return res.status(401).send('Необходима авторизация');
  }

  jwt.verify(token, secretKey, (err, user) => {
    if (err) {
      return res.status(403).send('Не действительный токен');
    }
    req.user = user;
    next();
  });
};

// Маршруты для авторизации
mainApp.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);

  if (!user) {
    return res.status(404).send('Пользователь не найден');
  }

  bcrypt.compare(password, user.password, (err, result) => {
    if (err || !result) {
      return res.status(403).send('Неверный пароль');
    }
    const token = generateToken(user);
    res.json({ token });
  });
});

mainApp.post('/api/auth/register', (req, res) => {  // Добавили /api/auth/
  const { username, password } = req.body;

  if (users.some(u => u.username === username)) {
      return res.status(400).send('Пользователь с таким именем уже существует');
  }

  bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
          return res.status(500).send('Ошибка регистрации');
      }
      const newUser = { id: users.length + 1, username, password: hashedPassword };
      users.push(newUser);
      const token = generateToken(newUser);
      res.status(201).json({ token });
  });
});


// Главная страница
mainApp.get('/', (req, res) => {
  res.sendFile(path.join(mainPagePath, 'index.html'));
});

// Страница администратора с защитой
adminApp.get('/', (req, res) => {
  res.sendFile(path.join(adminPagePath, '..', 'admin-panel', 'admin.html'));
});

const productsFilePath = path.join(__dirname, 'data', 'products.json');

// Схема GraphQL
const typeDefs = gql`
  type Product {
    id: ID!
    name: String!
    price: Float!
    description: String!
    categories: [String!]!
  }

  type Query {
    products: [Product]
    product(id: ID!): Product
  }

  type Mutation {
    addProduct(name: String!, price: Float!, description: String!, categories: [String!]!): Product
    updateProduct(id: ID!, name: String, price: Float, description: String, categories: [String]): Product
    deleteProduct(id: ID!): String
  }

  type Message {
    username: String!
    message: String!
  }

  type Subscription {
    messageAdded: Message
  }
`;

// Резолверы для GraphQL
const resolvers = {
  Query: {
    products: () => {
      const data = fs.readFileSync(productsFilePath, 'utf8');
      const products = JSON.parse(data);
      products.forEach(product => {
        product.price = parseFloat(product.price);
      });
      return products;
    },
    product: (_, { id }) => {
      const data = fs.readFileSync(productsFilePath, 'utf8');
      const products = JSON.parse(data);
      const product = products.find(p => p.id === parseInt(id));
      if (product) {
        product.price = product.price;
      }
      return product;
    },
  },
  Mutation: {
    addProduct: (_, { name, price, description, categories }) => {
      const data = fs.readFileSync(productsFilePath, 'utf8');
      const products = JSON.parse(data);
      const newProduct = {
        id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
        name,
        price,
        description,
        categories,
      };
      products.push(newProduct);
      fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2));
      return newProduct;
    },
    updateProduct: (_, { id, name, price, description, categories }) => {
      const data = fs.readFileSync(productsFilePath, 'utf8');
      let products = JSON.parse(data);
      const index = products.findIndex(p => p.id === parseInt(id));
      if (index === -1) return null;
      if (price) {
        price = price;
      }
      products[index] = { ...products[index], name, price, description, categories };
      fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2));
      return products[index];
    },
    deleteProduct: (_, { id }) => {
      const data = fs.readFileSync(productsFilePath, 'utf8');
      let products = JSON.parse(data);
      products = products.filter(p => p.id !== parseInt(id));
      fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2));
      return "Product deleted successfully"; 
    },
  },
  Subscription: {
    messageAdded: {
      subscribe: (_, __, { pubsub }) => pubsub.asyncIterator("MESSAGE_ADDED")
    }
  }
};

// Создание и запуск Apollo Server
const server = new ApolloServer({ 
  typeDefs, 
  resolvers, 
  context: ({ req }) => {
    return { pubsub: pubsub };  
  }
});

(async () => {
  await server.start();
  server.applyMiddleware({ app: mainApp });

  // Запуск серверов на разных портах
  mainApp.listen(mainPort, () => {
    console.log(`Главная страница доступна на http://localhost:${mainPort}/`);
    console.log(`GraphQL API доступен на http://localhost:${mainPort}${server.graphqlPath}`);
  });

  adminApp.listen(adminPort, () => {
    console.log(`Страница администратора доступна на http://localhost:${adminPort}/`);
  });
})();

// WebSocket сервер для чата
const wsServer = new WebSocket.Server({ port: wsPort });
const { PubSub } = require('graphql-subscriptions');
const pubsub = new PubSub();

// Взаимодействие с WebSocket
wsServer.on('connection', ws => {
  console.log('Пользователь подключился');
  
  ws.on('message', message => {
    wsServer.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
    
    const messageData = JSON.parse(message);
    pubsub.publish("MESSAGE_ADDED", { messageAdded: messageData });
  });
});

console.log(`WebSocket сервер запущен на ws://localhost:${wsPort}`);
