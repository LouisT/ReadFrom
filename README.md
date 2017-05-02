# ReadFrom (WIP convert to ES6, see TODO below)
Read text content from different endpoints with Node.js.

#### Quick examples:
```javascript
// Initiate the ReadFrom instance. Alternative:
//    var ReadFrom = require('readfrom'),
//        RF = new ReadFrom();
var ReadFrom = new (require('readfrom'))();

// Read from a file.
ReadFrom.file('file.txt').then((data) => {
   console.log(data);
 }).catch((error) => {
   console.trace(error);
});

// Read from a file, line by line.
ReadFrom.file('file.txt', undefined, (line) => {
   console.log('LINE: %s', line);
});

// Read from STDIN. (echo "This is an example." | node stdin-example.js)
ReadFrom.stdin().then((data) =>
   console.log(data); // `This is an example.`
 }).catch((error) => {
   console.trace(error);
});

// Read from STDIN, line by line. (cat file.txt | node stdin-by-line.js)
ReadFrom.stdin(undefined, (line) => {
   console.log('LINE: %s', line);
});

// Read from a URL.
ReadFrom.url('https://example.com/').then((data) => {
   console.log(data); // Print the example.com HTML content.
 }).catch((error) => {
   console.trace(error);
});

// Read from a URL, line by line.
ReadFrom.url('https://example.com/', undefined, (line) => {
   console.log('LINE: %s', line);
});

// Read from clipboard.
ReadFrom.clipboard().then((data) => {
   console.log(data); // Print whatever is in your clipboard.
 }).catch((error) => {
   console.trace(error);
});

// Read from clipboard, line by line.
ReadFrom.clipboard(undefined, (line) => {
   console.log('LINE: %s', line);
});


// Read STDOUT from child_process.spawn()
// https://nodejs.org/dist/latest/docs/api/child_process.html#child_process_child_process_spawn_command_args_options
ReadFrom.spawn('top', ['-n 1', '-b']).then((data) => {
   console.log(data); // Print a single iteration of the linux `top` command.
 }).catch((error) => {
   console.trace(error);
});

// Read STDOUT from child_process.spawn(), line by line.
// https://nodejs.org/dist/latest/docs/api/child_process.html#child_process_child_process_spawn_command_args_options
ReadFrom.spawn('top', ['-n 1', '-b'], undefined, (line) => {
   console.log('LINE: %s', line); // Print a single iteration of the linux `top` command.
});

// Create a readable stream number counter.
var Readable = require('stream').Readable,
    Stream = new Readable;
Stream._read = (function (c, m) {
   return function () { this.push((c <= m ? Buffer.from(String(c++)) : null)); }
})(0, 50);
ReadFrom.stream(Stream).then(function (data) {
   console.log(data); // Print the numbers, from the counter stream.
 }).catch(function (error) {
   console.trace(error);
});

// Create a readable stream number counter, with new lines for lineParser.
var Readable = require('stream').Readable,
    Stream = new Readable;
Stream._read = ((c, m) => {
    return () => { Stream.push((c <= m ? Buffer.from(String([c++, "\n"].join(''))) : null)); };
})(0, 50);
ReadFrom.stream(Stream, undefined, (num) => {
   console.log(num);
});

// Read from a TCP socket. (echo "This is an example!" | nc 127.0.0.1 8080)
// Address defaults to 0.0.0.0!
ReadFrom.port(8080, { address: '127.0.0.1' }).then((data) => {
    console.log(data);
 }).catch((error) => {
    console.log(error);
});

// Read from a TCP socket, line by line. (cat file.txt | nc 127.0.0.1 8080)
// Address defaults to 0.0.0.0!
ReadFrom.port(8080, { address: '127.0.0.1' }, (line) => {
    console.log('LINE: %s', line);
 }).then(function () {
    console.log('\nFinished!');
 }).catch((error) => {
    console.log(error);
});

// Read from a UNIX socket, line by line. (cat file.txt | nc -U /tmp/ReadFrom.sock)
// NOTE: This also works without line by line parsing, by returning with a Promise.
//       ReadFrom.unixSocket('/tmp/my-socket.sock').then((data) => { }).catch(() => { })
ReadFrom.unixSocket(undefined, undefined, (line) => {
    console.log('LINE: %s', line);
 }).then(function () {
    console.log('\nFinished!');
 }).catch((error) => {
    console.log(error);
});

```

TODO:
* Add: ReadFrom.ssh
* Update "quick examples" to ES6.
* Create documentation.
* Add tests with mocha.
