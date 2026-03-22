const express = require('express');
const nunjucks = require('nunjucks');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

nunjucks.configure('views', {
  autoescape: true,
  express: app
});

app.set('view engine', 'njk');

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.render('index.njk');
});

app.listen(PORT, () => {
  console.log(`Server is running at port ${PORT}`);
});
