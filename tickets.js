// tickets.js
const express = require('express');
const router = express.Router();

// Route för att skapa en biljett
router.post('/server', (req, res) => {
    const { title, description, category, user_id } = req.body;
    // Här lägger du till logiken för att spara biljetten i databasen
    res.send('Biljett skapad!');
});

// Exportera router så att den kan användas i din huvudsakliga app
module.exports = router;
