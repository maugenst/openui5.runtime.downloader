# openui5.runtime.downloader
This bundle downloads the full blown officially released OpenUI5 runtime zip
using the packages own version from http://openui5.hana.ondemand.com/downloads and unpacks it locally
to the folder lib/<version>. It also deletes the debug javascript sources. With this it can be used
to statically and exposed by a webserver (i.e. node/express) and then be consumed by your UI5 app.

## NodeJS / express

app.js

```
var express = require('express');
 var app = express();
 
 app.get('/', function (req, res) {
   res.send('Hello World!');
 });
 
 app.listen(3000, function () {
   console.log('Example app listening on port 3000!');
 });
```

