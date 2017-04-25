# ReadFrom
Read text content from different endpoints with Node.js.

#### Quick examples:
```javascript
ReadFrom().file('file.txt').then(function (data) {
   console.log(data);
 }).catch(function (error) {
   console.trace(error);
});

// echo "This is an example." | node stdin-example.js
ReadFrom().stdin().then(function (data) {
   console.log(data); // `This is an example.`
 }).catch(function (error) {
   console.trace(error);
});

ReadFrom().url('https://example.com/').then(function (data) {
   console.log(data); // Print the example.com HTML content.
 }).catch(function (error) {
   console.trace(error);
});

// Desktop only feature.
ReadFrom().clipboard().then(function (data) {
   console.log(data); // Print whatever is in your clipboard.
 }).catch(function (error) {
   console.trace(error);
});

// Read STDOUT from child_process.spawn()
// https://nodejs.org/dist/latest/docs/api/child_process.html#child_process_child_process_spawn_command_args_options
ReadFrom().spawn('top', ['-n 1', '-b']).then(function (data) {
   console.log(data); // Print a single iteration of the linux `top` command.
 }).catch(function (error) {
   console.trace(error);
});

// Create a readable stream number counter.
var Readable = require('stream').Readable,
    Stream = new Readable;
Stream._read = (function (c, m) {
   return function () { this.push((c <= m ? Buffer.from(String(c++)) : null)); }
})(0, 50);
ReadFrom().stream(Stream).then(function (data) {
   console.log(data); // Print the numbers, from the counter stream.
 }).catch(function (error) {
   console.trace(error);
});

// Read STDOUT/STDERR from a (non-interactive) remote SSH server connection, using ssh2.
//   NOTE: Supports all options for ssh2. https://github.com/mscdex/ssh2
//         Returns: { stdout: <String>, stderr: <String>, code: <Int>, signal: <String|Undefined> }
var obj = {
    host: 'server.domain.tld',
    port: 22,
    username: 'USERNAME',
    password: 'PASSWORD',
    // privateKey: require('fs').readFileSync('/path/to/key')
};
// Add spaces to output: uptime ; echo "" ; NOTAREALCOMMAND ; echo "" ; free -m ; echo "" ; ALSONOTACOMMAND
ReadFrom().ssh('uptime ; NOTAREALCOMMAND ; free -m ; ALSONOTACOMMAND', obj).then(function (results) {
    console.log('/* STDOUT */\n', results.stdout);
    if (results.stderr) {
       console.warn('\n/* STDERR */\n', results.stderr);
    }
 }).catch(function (error) {
    console.trace(error);
});
```

TODO:
* Create documentation.
* Add tests with mocha.
* Make the use of `ES6 Promise` better.
* Update to ES6.
