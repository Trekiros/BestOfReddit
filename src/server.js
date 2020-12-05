const express = require("express");
const path = require("path");

module.exports.default = function runServer() {
    // Properties
    const port = process.env.PORT || 3000;
    const static = path.join(__dirname, '../static');
    
    // Routes
    const app = express();
    app.use("/", express.static(static));

    // Start listening
    const server = app.listen(port, () => {
        console.log("web server initialized on port ", port);
    });

    return {app: app, server: server};
}