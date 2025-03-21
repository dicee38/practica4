const express = require('express');
const { ApolloServer, gql } = require('apollo-server-express');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const mainPort = 3000;
const adminPort = 8080;
const wsPort = 4000;

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

// Главная страница
mainApp.get('/', (req, res) => {
  res.sendFile(path.join(mainPagePath, 'index.html'));
});

// Страница администратора
adminApp.get('/', (req, res) => {
  res.sendFile(path.join(adminPagePath, 'admin.html'));
});

const productsFilePath = path.join(__dirname, 'data', 'products.json');

// GraphQL схема
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
      return "Product deleted successfully"; // Возвращаем просто строку
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
    return { pubsub: pubsub };  // Передача pubsub в контекст
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
    // Рассылаем сообщение всем подключенным клиентам
    wsServer.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
    
    // Публикуем сообщение через pubsub
    const messageData = JSON.parse(message);
    pubsub.publish("MESSAGE_ADDED", { messageAdded: messageData });
  });
});

console.log(`WebSocket сервер запущен на ws://localhost:${wsPort}`);
