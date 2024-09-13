const express = require('express'); // Import express
const app = express(); // Initialize the express app
const port = 3000; // Port to run the server on
const tickets = require('./routes/tickets'); // Importera tickets.js

app.use(express.static('public')); // hanterar statiska filer (HTML, CSS, JS, bilder, etc)
app.use(express.json()); // hantera HTTP POST request från klienten

// Route som hanterar GET-förfrågningar till /tickets
app.get("/tickets", (req, res) => {
    res.send("biljetten är hämtad");
}); //test

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
})


// GET request för att hämta data från servern
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});