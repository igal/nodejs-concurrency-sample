nodejs-concurrency-sample application
=====================================

This is a small application demonstrating concurrent programming using the [node.js](http://nodejs.org/) event-driven framework, [VisionMedia Express](http://expressjs.com/) web framework, and [Seq](https://github.com/substack/node-seq) concurrency library.

This application is very similar to my [sinatra-synchrony-sample](https://github.com/igal/sinatra-synchrony-sample) application, which is just built on a different stack -- Ruby, Sinatra, EventMachine, EventMachine::Synchrony, and Kyle Drake's [sinatra-synchrony](https://github.com/kyledrake/sinatra-synchrony) stack.

Running the application
-----------------------

1. Install [node.js](http://nodejs.org/) and [npm](http://npmjs.org/)
2. Install MySQL and its headers.
3. Install the application's dependencies:

        make setup
4. Edit the `Settings` lines at the top of the `app.js` file to set your database credentials if necessary.
5. Start the application:

        make serve
6. Access the application with your web browser: http://localhost:3000/

License
-------

This code provided under the MIT License, see `LICENSE.txt` for details.
