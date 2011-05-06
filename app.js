// Settings
var DATABASE_POOL_SIZE = 4;
var DATABASE_USER = 'root';
var DATABASE_PASSWORD = '';

// Libraries
var util = require('util');
var express = require('express')
var app = module.exports = express.createServer();
var sys = require('sys');
var Seq = require('seq');

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
var MySQLPool = require('mysql-pool').MySQLPool;
var db = new MySQLPool({});
db.properties.user = DATABASE_USER;
db.properties.password = DATABASE_PASSWORD;
db.connect(DATABASE_POOL_SIZE);

// Return length of array. Returns number of keys in an associative array or the number of elements in a regular array.
function array_length(array) {
  var count = 0;
  for (item in array) {
    count++;
  }
  return count;
}

// Return an array of database names.
function rows_to_names(rows) {
  var names = [];
  for (key in rows) {
    names.push(rows[key]['Database']);
  }
  return names;
}

// Display homepage
app.get('/', function(req, res){
  res.render('index', {title: 'Hello!'});
});

// Demonstrate sequential calls using nested callbacks. One query is run, which
// runs the next, which runs the next. The final query renders the page.
app.get('/sequential-callbacks', function(req, res){
  var number_of_calls = 2;
  var sleep_time = 0.2;
  var expected_time = number_of_calls * sleep_time;
  var t = new Date();

  db.query('select sleep('+sleep_time+')', function(err, rows, fields) {
    db.query('select sleep('+sleep_time+')', function(err2, rows2, fields2) {
      db.query('show databases', function(err3, rows3, fields3) {
        res.render('page', {
          title: 'Sequential calls using callbacks',
          elapsed_time: (new Date() - t)/1000,
          expected_time: expected_time,
          number_of_calls: number_of_calls,
          names: rows_to_names(rows3)
        });
      });
    });
  });
});

// Demonstrates sequential calls using the Seq library. It manages execution of
// functions, running each one and passing along the results, and the last one
// renders the page. This seems much clearer than using nested callbacks.
app.get('/sequential-with-seq', function(req, res){
  var number_of_calls = 2;
  var sleep_time = 0.2;
  var expected_time = number_of_calls * sleep_time;
  var t = new Date();

  Seq()
    .seq(function(){
      console.log('sequential-with-seq: starting sleeper #1');
      db.query('select sleep('+sleep_time+')', this);
    })
    .seq(function(rows, fields){
      console.log('sequential-with-seq: finished sleeper #1, got '+rows.length+' rows');
      console.log('sequential-with-seq: starting sleeper #2');
      db.query('select sleep('+sleep_time+')', this);
    })
    .seq(function(rows, fields){
      console.log('sequential-with-seq: finished sleeper #2, got '+rows.length+' rows');
      console.log('sequential-with-seq: starting name query');
      db.query('show databases', this);
    })
    .seq(function(rows, fields){
      console.log('sequential-with-seq: finished name query, got '+rows.length+' rows');
      res.render('page', {
        title: 'Sequential calls using Seq library',
        elapsed_time: (new Date() - t)/1000,
        expected_time: expected_time,
        number_of_calls: number_of_calls,
        names: rows_to_names(rows)
      });
    })
  ;
});

// This action demonstrates parallel execution using callbacks. The code is
// unusual because it starts a bunch of asynchronous queries that run in
// parallel, and each of these is responsible for uploading its results to a
// collector. When the collector has all the results, it renders the page.
app.get('/parallel-collector', function(req, res){
  var number_of_calls = DATABASE_POOL_SIZE-1;
  var sleep_time = 0.2;
  var expected_time = sleep_time;
  var t = new Date();

  // Results of queries as populated by the `collector`.
  var results = {
    sleepers: {},
    rows: null
  };

  // Populates the `results` data structure. This function is called by the
  // queries when they're done.
  var collector = function(name, payload) {
    // Store results
    if (name == 'sleep') {
      console.log('parallel: Sleeper #'+payload+' finished');
      results.sleepers[payload] = true;
    } else {
      console.log('parallel: Names query finished');
      results.rows = payload;
    }

    // Render page when done
    if (results.rows && array_length(results.sleepers) >= number_of_calls) {
      res.render('page', {
        title: 'Parallel calls using callback collector',
        elapsed_time: (new Date() - t)/1000,
        expected_time: expected_time,
        number_of_calls: number_of_calls,
        names: rows_to_names(results.rows)
      });
    }
  }

  // Asynchronous query to get names, will hand off results to the `collector` when done.
  var get_names = function() {
    db.query('show databases', function(err, rows, fields) {
      collector('names', rows);
    });
  }

  // Asynchronous query to sleep for a while, will contact the `collector` when done.
  var get_sleep = function(identifier) {
    db.query('select sleep('+sleep_time+')', function(err, rows, fields) {
      collector('sleep', identifier);
    });
  }

  // Start the queries. The `collector` will capture their results and render
  // the page when they finish.
  for (var i = 0; i<number_of_calls; i++) {
    get_sleep(i);
  }
  get_names();
});

// This action demonstrates parallel queries using the Seq library. This is
// significantly clearer than using callbacks and a collector.
app.get('/parallel-with-seq', function(req, res){
  var number_of_calls = DATABASE_POOL_SIZE-1;
  var sleep_time = 0.2;
  var expected_time = sleep_time;
  var t = new Date();

  var chain = Seq();
  for (var i = 0; i < number_of_calls; i++) {
    var identity = 'sleeper#'+i;
    chain.par(identity, function() {
      console.log('parallel-with-seq: starting sleeper');
      db.query('select sleep('+sleep_time+')', this);
    });
  }
  chain.par('names', function(){
    // Note the use of 'names' in the line above, this captures the query's
    // results into a named entry in the stack, which can be accessed later as
    // `this.vars['names']`.
    console.log('parallel-with-seq: starting name query');
    db.query('show databases', this);
  });
  chain.seq(function(rows, fields){
    console.log('parallel-with-seq: found '+array_length(this.vars)+' finished processes');
    res.render('page', {
      title: 'Parallel calls using Seq library',
      elapsed_time: (new Date() - t)/1000,
      expected_time: expected_time,
      number_of_calls: number_of_calls,
      names: rows_to_names(this.vars['names'])
    });
  })
});

var PORT = 3000;
app.listen(PORT);
console.log('Starting server at http://127.0.0.1:'+PORT+'/');
