// Settings
var DATABASE_POOL_SIZE = 4;
var DATABASE_USER = 'root';
var DATABASE_PASSWORD = '';

// Libraries
var util = require('util');
var express = require('express')
var app = module.exports = express.createServer();
var sys = require('sys');
// TODO var Worker = require('webworker').Worker;
// var Task = require('parallel').Task;

// Configuration
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'keyboard cat' }));
  app.use(express.logger());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

// Database
var MySQLPool = require("mysql-pool").MySQLPool;
var db = new MySQLPool({});
db.properties.user = DATABASE_USER;
db.properties.password = DATABASE_PASSWORD;
db.connect(DATABASE_POOL_SIZE);

app.get('/', function(req, res){
  res.render('index', {title: 'Hello!'});
});

app.get('/sequential', function(req, res){
  var number_of_calls = 2;
  var sleep_time = 0.2;
  var expected_time = number_of_calls * sleep_time;
  var t = new Date();

  db.query('select sleep('+sleep_time+')', function(err, rows, fields) {
    db.query('select sleep('+sleep_time+')', function(err2, rows2, fields2) {
      db.query('show databases', function(err3, rows3, fields3) {
        res.render('page', {
          title: 'Sequential calls',
          elapsed_time: (new Date() - t)/1000,
          expected_time: expected_time,
          number_of_calls: number_of_calls,
          rows: rows3
        });
      });
    });
  });
});

app.get('/parallel', function(req, res){
  var number_of_calls = DATABASE_POOL_SIZE-1;
  var sleep_time = 0.2;
  var expected_time = sleep_time;
  var t = new Date();

  var results = {sleepers: {}, rows: null};
  var collector = function(name, payload) {
    if (name == 'sleep') {
      console.log('parallel: Sleeper #'+payload+' finished');
      results.sleepers[payload] = true;
    } else {
      console.log('parallel: Names query finished');
      results.rows = payload;
    }

    var sleepers_finished = 0;
    for (key in results.sleepers) { sleepers_finished++; }
    if (results.rows && sleepers_finished >= number_of_calls) {
      res.render('page', {
        title: 'Parallel calls',
        elapsed_time: (new Date() - t)/1000,
        expected_time: expected_time,
        number_of_calls: number_of_calls,
        rows: results.rows
      });
    }
  }

  var get_names = function() {
    db.query('show databases', function(err, rows, fields) {
      collector('names', rows);
    });
  }

  var get_sleep = function(identifier) {
    db.query('select sleep('+sleep_time+')', function(err, rows, fields) {
      collector('sleep', identifier);
    });
  }

  for (var i = 0; i<number_of_calls; i++) {
    get_sleep(i);
  }
  get_names();
});

var PORT = 3000;
app.listen(PORT);
console.log('Starting server at http://127.0.0.1:'+PORT+'/');
