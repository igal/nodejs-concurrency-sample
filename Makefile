.PHONY: serve setup test

serve:
	node app.js

setup:
	npm install express jade webworker mysql mysql-pool seq
