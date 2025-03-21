const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Путь к файлу с данными
const productsFilePath = path.join(__dirname, '../data/products.json');

// Получение списка товаров
router.get('/', (req, res) => {
  fs.readFile(productsFilePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send('Ошибка при чтении файла товаров');
    }
    res.json(JSON.parse(data));
  });
});

// Добавление нового товара
router.post('/', (req, res) => {
  const newProduct = req.body;

  fs.readFile(productsFilePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send('Ошибка при чтении файла товаров');
    }
    const products = JSON.parse(data);
    products.push(newProduct);

    fs.writeFile(productsFilePath, JSON.stringify(products, null, 2), (err) => {
      if (err) {
        return res.status(500).send('Ошибка при сохранении товара');
      }
      res.status(201).send('Товар добавлен');
    });
  });
});

// Обновление товара
router.put('/:id', (req, res) => {
  const productId = parseInt(req.params.id);
  const updatedProduct = req.body;

  fs.readFile(productsFilePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send('Ошибка при чтении файла товаров');
    }
    const products = JSON.parse(data);
    const productIndex = products.findIndex(p => p.id === productId);
    if (productIndex !== -1) {
      products[productIndex] = { ...products[productIndex], ...updatedProduct };

      fs.writeFile(productsFilePath, JSON.stringify(products, null, 2), (err) => {
        if (err) {
          return res.status(500).send('Ошибка при обновлении товара');
        }
        res.send('Товар обновлен');
      });
    } else {
      res.status(404).send('Товар не найден');
    }
  });
});

// Удаление товара
router.delete('/:id', (req, res) => {
  const productId = parseInt(req.params.id);

  fs.readFile(productsFilePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send('Ошибка при чтении файла товаров');
    }
    let products = JSON.parse(data);
    products = products.filter(p => p.id !== productId);

    fs.writeFile(productsFilePath, JSON.stringify(products, null, 2), (err) => {
      if (err) {
        return res.status(500).send('Ошибка при удалении товара');
      }
      res.send('Товар удален');
    });
  });
});

module.exports = router;
